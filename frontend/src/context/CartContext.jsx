import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import commerceService from "../Services/commerceService.js";

const STORAGE_KEY = "salonai_cart_v1";

export const CartContext = createContext(null);

function appointmentAmountPaid(appointment) {
  const value = Number(appointment?.amountPaid ?? 0);
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function appointmentTotal(appointment) {
  const value = Number(
    appointment?.finalPrice ??
      appointment?.totalPrice ??
      appointment?.service?.price ??
      0
  );
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function appointmentBalance(appointment) {
  const explicit = Number(appointment?.balanceDue);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  return Math.max(0, appointmentTotal(appointment) - appointmentAmountPaid(appointment));
}

function appointmentDeposit(appointment, percentage = 25) {
  const balance = appointmentBalance(appointment);
  const configured = Number(percentage);
  const safePercentage = Number.isFinite(configured)
    ? Math.min(100, Math.max(1, configured))
    : 25;
  return Math.min(
    balance,
    Math.max(0.01, balance * (safePercentage / 100))
  );
}

function normaliseStoredItem(item) {
  if (!item || typeof item !== "object") return null;

  if (item.type === "appointment" || item.appointmentId) {
    const appointmentId = String(item.appointmentId || "").trim();
    if (!appointmentId) return null;
    const paymentPurpose = item.paymentPurpose === "deposit" ? "deposit" : "balance";
    return {
      ...item,
      type: "appointment",
      cartKey: item.cartKey || `appointment:${appointmentId}:${paymentPurpose}`,
      appointmentId,
      paymentPurpose,
      quantity: 1,
      stockQuantity: 1,
    };
  }

  const productId = String(item.productId || "").trim();
  if (!productId) return null;
  return {
    ...item,
    type: "product",
    cartKey: item.cartKey || `product:${productId}`,
    productId,
  };
}

function readCart() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(value)
      ? value.map(normaliseStoredItem).filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(readCart);
  const [appointmentDepositPercentage, setAppointmentDepositPercentage] = useState(25);

  useEffect(() => {
    let active = true;
    commerceService
      .getConfig()
      .then((config) => {
        const configured = Number(config?.appointmentDepositPercentage);
        if (active && Number.isFinite(configured)) {
          setAppointmentDepositPercentage(Math.min(100, Math.max(1, configured)));
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const addItem = useCallback((product, quantity = 1) => {
    setItems((current) => {
      const productId = String(product._id || product.id);
      const available = Math.max(0, Number(product.stockQuantity || 0));
      const requested = Math.max(1, Number.parseInt(quantity, 10) || 1);
      const existing = current.find(
        (item) => item.type === "product" && item.productId === productId
      );

      if (existing) {
        return current.map((item) =>
          item.type === "product" && item.productId === productId
            ? { ...item, quantity: Math.min(available, item.quantity + requested) }
            : item
        );
      }

      return [
        ...current,
        {
          type: "product",
          cartKey: `product:${productId}`,
          productId,
          name: product.name,
          sku: product.sku,
          price: Number(product.price || 0),
          image: product.images?.[0] || "",
          stockQuantity: available,
          quantity: Math.min(available, requested),
        },
      ];
    });
  }, []);

  const addAppointment = useCallback((appointment, purpose = "balance") => {
    setItems((current) => {
      const appointmentId = String(appointment?._id || appointment?.id || "").trim();
      if (!appointmentId) return current;

      const paymentPurpose = purpose === "deposit" ? "deposit" : "balance";
      const balance = appointmentBalance(appointment);
      const price = paymentPurpose === "deposit"
        ? appointmentDeposit(appointment, appointmentDepositPercentage)
        : balance;

      if (!(price > 0)) return current;

      const name =
        appointment?.service?.name ||
        appointment?.serviceName ||
        "Salon appointment";

      const withoutThisAppointment = current.filter(
        (item) => !(item.type === "appointment" && item.appointmentId === appointmentId)
      );

      return [
        ...withoutThisAppointment,
        {
          type: "appointment",
          cartKey: `appointment:${appointmentId}:${paymentPurpose}`,
          appointmentId,
          paymentPurpose,
          name: paymentPurpose === "deposit" ? `${name} deposit` : `${name} balance`,
          sku: `APPOINTMENT-${appointmentId.slice(-8).toUpperCase()}`,
          price: Number(price.toFixed(2)),
          image: "",
          stockQuantity: 1,
          quantity: 1,
        },
      ];
    });
  }, [appointmentDepositPercentage]);

  const updateQuantity = useCallback((identifier, quantity) => {
    setItems((current) =>
      current
        .map((item) => {
          const matches =
            item.cartKey === identifier ||
            item.productId === identifier;

          if (!matches || item.type !== "product") return item;

          return {
            ...item,
            quantity: Math.max(
              0,
              Math.min(item.stockQuantity, Number.parseInt(quantity, 10) || 0)
            ),
          };
        })
        .filter((item) => item.type === "appointment" || item.quantity > 0)
    );
  }, []);

  const removeItem = useCallback((identifier) => {
    setItems((current) =>
      current.filter(
        (item) =>
          item.cartKey !== identifier &&
          item.productId !== identifier &&
          item.appointmentId !== identifier
      )
    );
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const value = useMemo(() => {
    const itemCount = items.reduce(
      (sum, item) => sum + (item.type === "appointment" ? 1 : item.quantity),
      0
    );
    const subtotal = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
    const productItems = items.filter((item) => item.type === "product");
    const appointmentItems = items.filter((item) => item.type === "appointment");

    return {
      items,
      productItems,
      appointmentItems,
      itemCount,
      subtotal,
      addItem,
      addAppointment,
      updateQuantity,
      removeItem,
      clearCart,
    };
  }, [items, addItem, addAppointment, updateQuantity, removeItem, clearCart]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
