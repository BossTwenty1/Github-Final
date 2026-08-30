-- Keep the related deceased and burial rows consistent as one database operation.
-- This migration is intentionally local until the hosted schema is separately approved.

begin;

create or replace function public.admin_create_burial_record(
    p_display_name text,
    p_birth_date date,
    p_death_date date,
    p_public_display boolean,
    p_lot_id bigint,
    p_interment_date date,
    p_record_status text,
    p_interment_status text,
    p_remains_type text,
    p_reference_no text,
    p_service_provider text,
    p_record_source text,
    p_quality_notes text
)
returns bigint
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
    actor_id uuid := auth.uid();
    deceased_id_value bigint;
    burial_id_value bigint;
    lot_status_value text;
    existing_burial_id bigint;
begin
    if actor_id is null or not public.is_active_admin_or_manager() then
        raise exception 'Only active ADMIN or MANAGER accounts may create burial records';
    end if;

    if nullif(trim(p_display_name), '') is null then
        raise exception 'A display name is required';
    end if;

    select l.status
      into lot_status_value
      from public.lot as l
     where l.lot_id = p_lot_id
     for update;

    if lot_status_value is null or lot_status_value <> 'AVAILABLE' then
        raise exception 'The selected plot is not available';
    end if;

    select br.burial_id
      into existing_burial_id
      from public.burial_record as br
     where br.lot_id = p_lot_id
     limit 1
     for update;

    if existing_burial_id is not null then
        raise exception 'The selected plot already has a burial record';
    end if;

    insert into public.deceased (
        display_name,
        birth_date,
        death_date,
        public_display
    ) values (
        trim(p_display_name),
        p_birth_date,
        p_death_date,
        coalesce(p_public_display, false)
    )
    returning deceased_id into deceased_id_value;

    insert into public.burial_record (
        deceased_id,
        lot_id,
        created_by,
        updated_by,
        reference_no,
        interment_date,
        record_status,
        interment_status,
        remains_type,
        service_provider,
        record_source,
        quality_notes
    ) values (
        deceased_id_value,
        p_lot_id,
        actor_id,
        actor_id,
        p_reference_no,
        p_interment_date,
        p_record_status,
        p_interment_status,
        p_remains_type,
        p_service_provider,
        p_record_source,
        p_quality_notes
    )
    returning burial_id into burial_id_value;

    return burial_id_value;
end;
$$;

create or replace function public.admin_update_burial_record(
    p_burial_id bigint,
    p_display_name text,
    p_birth_date date,
    p_death_date date,
    p_public_display boolean,
    p_lot_id bigint,
    p_interment_date date,
    p_record_status text,
    p_interment_status text,
    p_remains_type text,
    p_reference_no text,
    p_service_provider text,
    p_record_source text,
    p_quality_notes text
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
    actor_id uuid := auth.uid();
    current_deceased_id bigint;
    current_lot_id bigint;
    lot_status_value text;
    existing_burial_id bigint;
begin
    if actor_id is null or not public.is_active_admin_or_manager() then
        raise exception 'Only active ADMIN or MANAGER accounts may update burial records';
    end if;

    if nullif(trim(p_display_name), '') is null then
        raise exception 'A display name is required';
    end if;

    select br.deceased_id, br.lot_id
      into current_deceased_id, current_lot_id
      from public.burial_record as br
     where br.burial_id = p_burial_id
     for update;

    if current_deceased_id is null then
        raise exception 'The burial record could not be found';
    end if;

    perform 1
      from public.deceased as d
     where d.deceased_id = current_deceased_id
     for update;

    if p_lot_id <> current_lot_id then
        select l.status
          into lot_status_value
          from public.lot as l
         where l.lot_id = p_lot_id
         for update;

        if lot_status_value is null or lot_status_value <> 'AVAILABLE' then
            raise exception 'The selected plot is not available';
        end if;

        select br.burial_id
          into existing_burial_id
          from public.burial_record as br
         where br.lot_id = p_lot_id
         limit 1
         for update;

        if existing_burial_id is not null then
            raise exception 'The selected plot already has a burial record';
        end if;
    end if;

    update public.deceased
       set display_name = trim(p_display_name),
           birth_date = p_birth_date,
           death_date = p_death_date,
           public_display = coalesce(p_public_display, false)
     where deceased_id = current_deceased_id;

    update public.burial_record
       set lot_id = p_lot_id,
           updated_by = actor_id,
           reference_no = p_reference_no,
           interment_date = p_interment_date,
           record_status = p_record_status,
           interment_status = p_interment_status,
           remains_type = p_remains_type,
           service_provider = p_service_provider,
           record_source = p_record_source,
           quality_notes = p_quality_notes
     where burial_id = p_burial_id;
end;
$$;

create or replace function public.admin_delete_burial_record(p_burial_id bigint)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
    current_deceased_id bigint;
    linked_burial_count bigint;
begin
    if auth.uid() is null or not public.is_active_admin_or_manager() then
        raise exception 'Only active ADMIN or MANAGER accounts may delete burial records';
    end if;

    select br.deceased_id
      into current_deceased_id
      from public.burial_record as br
     where br.burial_id = p_burial_id
     for update;

    if current_deceased_id is null then
        raise exception 'The burial record could not be found';
    end if;

    select count(*)
      into linked_burial_count
      from public.burial_record as br
     where br.deceased_id = current_deceased_id;

    if linked_burial_count <> 1 then
        raise exception 'The deceased record is linked to more than one burial record';
    end if;

    delete from public.burial_record
     where burial_id = p_burial_id;

    delete from public.deceased
     where deceased_id = current_deceased_id;
end;
$$;

revoke all on function public.admin_create_burial_record(text, date, date, boolean, bigint, date, text, text, text, text, text, text, text) from public;
revoke all on function public.admin_update_burial_record(bigint, text, date, date, boolean, bigint, date, text, text, text, text, text, text, text) from public;
revoke all on function public.admin_delete_burial_record(bigint) from public;
grant execute on function public.admin_create_burial_record(text, date, date, boolean, bigint, date, text, text, text, text, text, text, text) to authenticated;
grant execute on function public.admin_update_burial_record(bigint, text, date, date, boolean, bigint, date, text, text, text, text, text, text, text) to authenticated;
grant execute on function public.admin_delete_burial_record(bigint) to authenticated;

commit;
