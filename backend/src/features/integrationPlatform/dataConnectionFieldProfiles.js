const PROFILES = Object.freeze({
  amazon_sp: Object.freeze({
    default: "orders",
    profiles: Object.freeze({
      orders: Object.freeze({
        label: "Orders & revenue",
        fields: Object.freeze([
          "date", "account_id", "account_name",
          "flat_file_all_orders_data_by_last_update_general__amazon_order_id",
          "flat_file_all_orders_data_by_last_update_general__purchase_date",
          "flat_file_all_orders_data_by_last_update_general__last_updated_date",
          "flat_file_all_orders_data_by_last_update_general__asin",
          "flat_file_all_orders_data_by_last_update_general__product_name",
          "flat_file_all_orders_data_by_last_update_general__quantity",
          "flat_file_all_orders_data_by_last_update_general__item_price",
          "flat_file_all_orders_data_by_last_update_general__item_tax",
          "flat_file_all_orders_data_by_last_update_general__currency",
          "flat_file_all_orders_data_by_last_update_general__order_status",
          "flat_file_all_orders_data_by_last_update_general__sales_channel",
          "flat_file_all_orders_data_by_last_update_general__fulfillment_channel",
        ]),
        kpis: Object.freeze([
          { key: "revenue", field: "flat_file_all_orders_data_by_last_update_general__item_price", aggregate: "sum", label: "Order revenue" },
          { key: "orders", field: "flat_file_all_orders_data_by_last_update_general__amazon_order_id", aggregate: "distinct", label: "Orders" },
          { key: "units", field: "flat_file_all_orders_data_by_last_update_general__quantity", aggregate: "sum", label: "Units" },
        ]),
      }),
      inventory: Object.freeze({
        label: "FBA inventory health",
        fields: Object.freeze([
          "date", "account_id", "account_name",
          "fba_myi_unsuppressed_inventory_data__asin",
          "fba_myi_unsuppressed_inventory_data__sku",
          "fba_myi_unsuppressed_inventory_data__afn_fulfillable_quantity",
          "fba_myi_unsuppressed_inventory_data__afn_reserved_quantity",
          "fba_myi_unsuppressed_inventory_data__afn_total_quantity",
          "fba_myi_unsuppressed_inventory_data__afn_unsellable_quantity",
          "fba_inventory_planning_data__sales_shipped_last_7_days",
          "fba_inventory_planning_data__sales_shipped_last_30_days",
          "fba_inventory_planning_data__units_shipped_t30",
          "fba_inventory_planning_data__sell_through",
        ]),
        kpis: Object.freeze([
          { key: "fulfillableUnits", field: "fba_myi_unsuppressed_inventory_data__afn_fulfillable_quantity", aggregate: "sum", label: "Fulfillable units" },
          { key: "unitsShipped30", field: "fba_inventory_planning_data__units_shipped_t30", aggregate: "sum", label: "Units shipped (30d)" },
          { key: "sellThrough", field: "fba_inventory_planning_data__sell_through", aggregate: "avg", label: "Sell-through" },
        ]),
      }),
    }),
  }),
  ebay: Object.freeze({
    default: "orders",
    profiles: Object.freeze({
      orders: Object.freeze({
        label: "Orders & seller proceeds",
        fields: Object.freeze([
          "date", "account_id", "account_name", "order_id", "order_creation_time",
          "order_financial_status", "order_fulfillment_status", "currency", "line_item_count",
          "order_total", "total_due_seller", "total_marketplace_fee", "refund_count", "buyer_country",
        ]),
        kpis: Object.freeze([
          { key: "grossSales", field: "order_total", aggregate: "sum", label: "Gross sales" },
          { key: "sellerProceeds", field: "total_due_seller", aggregate: "sum", label: "Seller proceeds" },
          { key: "marketplaceFees", field: "total_marketplace_fee", aggregate: "sum", label: "Marketplace fees" },
          { key: "orders", field: "order_id", aggregate: "distinct", label: "Orders" },
        ]),
      }),
      traffic: Object.freeze({
        label: "Listing traffic & conversion",
        fields: Object.freeze([
          "date", "account_id", "account_name", "listing_impression_total", "listing_views_total",
          "click_through_rate", "sales_conversion_rate", "transactions",
        ]),
        kpis: Object.freeze([
          { key: "impressions", field: "listing_impression_total", aggregate: "sum", label: "Listing impressions" },
          { key: "views", field: "listing_views_total", aggregate: "sum", label: "Listing views" },
          { key: "transactions", field: "transactions", aggregate: "sum", label: "Transactions" },
          { key: "conversion", field: "sales_conversion_rate", aggregate: "avg", label: "Conversion rate" },
        ]),
      }),
      promotedListings: Object.freeze({
        label: "Promoted Listings",
        fields: Object.freeze([
          "date", "account_id", "account_name", "campaign_id", "campaign_name",
          "promoted_listings_impressions", "promoted_listings_clicks", "promoted_listings_sales",
          "promoted_listings_sale_amount", "promoted_listings_ad_fees", "promoted_listings_roas",
        ]),
        kpis: Object.freeze([
          { key: "adSales", field: "promoted_listings_sale_amount", aggregate: "sum", label: "Attributed sales" },
          { key: "adFees", field: "promoted_listings_ad_fees", aggregate: "sum", label: "Ad fees" },
          { key: "roas", field: "promoted_listings_roas", aggregate: "avg", label: "ROAS" },
        ]),
      }),
    }),
  }),
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function listDataConnectionFieldProfiles(productKey) {
  const entry = PROFILES[String(productKey || "").trim().toLowerCase()];
  if (!entry) return [];
  return Object.entries(entry.profiles).map(([key, value]) => ({
    key,
    ...clone(value),
    isDefault: key === entry.default,
  }));
}

export function resolveDataConnectionFieldProfile(productKey, profileKey = "") {
  const entry = PROFILES[String(productKey || "").trim().toLowerCase()];
  if (!entry) return null;
  const key = String(profileKey || entry.default).trim();
  const profile = entry.profiles[key];
  return profile ? { key, ...clone(profile), isDefault: key === entry.default } : null;
}

export default { listDataConnectionFieldProfiles, resolveDataConnectionFieldProfile };
