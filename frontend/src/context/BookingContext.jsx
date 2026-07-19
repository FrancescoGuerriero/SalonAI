import { createContext, useEffect, useState } from "react";

export const BookingContext = createContext(null);

const initialBooking = {
  service: null,
  stylist: null,
  appointmentDate: "",
  appointmentTime: ""
};

function readStoredBooking() {
  try {
    const storedBooking = localStorage.getItem("salonAI_booking");
    return storedBooking ? JSON.parse(storedBooking) : initialBooking;
  } catch {
    return initialBooking;
  }
}

export function BookingProvider({ children }) {
  const [booking, setBooking] = useState(readStoredBooking);

  useEffect(() => {
    localStorage.setItem("salonAI_booking", JSON.stringify(booking));
  }, [booking]);

  function clearBooking() {
    setBooking(initialBooking);
    localStorage.removeItem("salonAI_booking");
  }

  return (
    <BookingContext.Provider value={{ booking, setBooking, clearBooking }}>
      {children}
    </BookingContext.Provider>
  );
}