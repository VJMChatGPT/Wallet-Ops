alter table tracked_wallets
add column if not exists sort_order integer;

with ordered_wallets as (
  select
    id,
    row_number() over (order by created_at asc, id asc) - 1 as next_sort_order
  from tracked_wallets
  where sort_order is null
)
update tracked_wallets as tracked
set sort_order = ordered_wallets.next_sort_order
from ordered_wallets
where tracked.id = ordered_wallets.id;

create index if not exists tracked_wallets_sort_order_idx
on tracked_wallets (sort_order);
