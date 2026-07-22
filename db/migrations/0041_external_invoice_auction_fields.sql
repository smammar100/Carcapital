-- GEN-80: "Auction purchase" already existed as an invoice kind (with a
-- Vendor field standing in for the auction house/seller name), but the
-- auction-specific details called out in the UAT walkthrough — previous
-- owner, service history reference — had nowhere to go.
alter table external_invoices
  add column previous_owner text,
  add column service_history_ref text;

comment on column external_invoices.previous_owner is
  'Auction-purchase only: the vehicle''s previous registered keeper, if disclosed by the auction house.';
comment on column external_invoices.service_history_ref is
  'Auction-purchase only: reference to the service history pack/booklet supplied with the vehicle.';
