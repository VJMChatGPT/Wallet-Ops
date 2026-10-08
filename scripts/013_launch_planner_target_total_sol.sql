alter table if exists public.launch_plans
  add column if not exists target_total_sol numeric null;

update public.launch_plans
set target_total_sol = target_average_sol * greatest(desired_wallet_count, 1)
where target_total_sol is null
  and target_average_sol is not null;
