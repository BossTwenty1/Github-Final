-- GraveNav Phase 1 map data import generated from the cleaned KML GeoJSON.
-- Data-only import: no tables, columns, policies, or functions are changed.
-- Review the read-only checks before committing this transaction in hosted Supabase.
-- The import uses existing site_id 1 and does not create plots, lots, graves, owners, sectors, or blocks.

select site_id, site_name, address, (boundary_geom is not null) as already_has_boundary
from public.site where site_id = 1;

begin;

do $$
declare site_count integer;
begin
  select count(*) into site_count from public.site where site_id = 1;
  if site_count <> 1 then raise exception 'Expected exactly one Forest Lake site row with site_id 1'; end if;
end $$;

update public.site set boundary_geom = st_setsrid(st_geomfromgeojson($geojson${"type":"Polygon","coordinates":[[[123.7403651377267,13.12782596874229],[123.7406037367828,13.12784499525643],[123.7407289142752,13.12788688507238],[123.7408464011529,13.12789462764139],[123.740991875098,13.12787949360306],[123.7411041243411,13.12780317205446],[123.7413319691318,13.1275506140704],[123.7417583862641,13.12783968768569],[123.7417441848813,13.12808293463575],[123.742417875768,13.12840957824183],[123.7424363708249,13.12906879532538],[123.7394451801504,13.12934857493199],[123.7396684819317,13.12801018088061],[123.7403651377267,13.12782596874229]]]}$geojson$), 4326)::extensions.geography, updated_at = current_timestamp where site_id = 1;

do $$
declare area_id_value bigint;
begin
  select area_id into area_id_value from public.area where site_id = 1 and area_code = 'RPG' limit 1;
  if area_id_value is null then
    insert into public.area (site_id, area_code, area_name, area_category, boundary_geom) values (1, 'RPG', 'Royal Palm Garden', 'garden', st_setsrid(st_geomfromgeojson($geojson${"type":"Polygon","coordinates":[[[123.7405340513382,13.12820755063447],[123.7405066612439,13.12816343642655],[123.7404806711216,13.12813767776098],[123.7404525209434,13.12811525342111],[123.7404195603137,13.1280999225715],[123.7403261297797,13.12807332741856],[123.7403230036469,13.12805506298938],[123.7403414812124,13.12804960326467],[123.7404983315581,13.12807232970278],[123.7406147024229,13.12807392695482],[123.7407606331736,13.12806048921294],[123.741036159797,13.12796452541898],[123.7411429135648,13.1278967151451],[123.7412141625103,13.1278809595824],[123.7413123875126,13.12776945816947],[123.7413414430044,13.12774956908757],[123.7415185343968,13.12783305447281],[123.7414976473856,13.12840058018856],[123.7414705106534,13.12841822289885],[123.7406339858848,13.12849744433313],[123.7405340513382,13.12820755063447]]]}$geojson$), 4326)::extensions.geography) returning area_id into area_id_value;
  else
    update public.area set area_name = 'Royal Palm Garden', area_category = 'garden', boundary_geom = st_setsrid(st_geomfromgeojson($geojson${"type":"Polygon","coordinates":[[[123.7405340513382,13.12820755063447],[123.7405066612439,13.12816343642655],[123.7404806711216,13.12813767776098],[123.7404525209434,13.12811525342111],[123.7404195603137,13.1280999225715],[123.7403261297797,13.12807332741856],[123.7403230036469,13.12805506298938],[123.7403414812124,13.12804960326467],[123.7404983315581,13.12807232970278],[123.7406147024229,13.12807392695482],[123.7407606331736,13.12806048921294],[123.741036159797,13.12796452541898],[123.7411429135648,13.1278967151451],[123.7412141625103,13.1278809595824],[123.7413123875126,13.12776945816947],[123.7413414430044,13.12774956908757],[123.7415185343968,13.12783305447281],[123.7414976473856,13.12840058018856],[123.7414705106534,13.12841822289885],[123.7406339858848,13.12849744433313],[123.7405340513382,13.12820755063447]]]}$geojson$), 4326)::extensions.geography where area_id = area_id_value;
  end if;
  select area_id into area_id_value from public.area where site_id = 1 and area_code = 'HPG' limit 1;
  if area_id_value is null then
    insert into public.area (site_id, area_code, area_name, area_category, boundary_geom) values (1, 'HPG', 'Hawaiian Palm Garden', 'garden', st_setsrid(st_geomfromgeojson($geojson${"type":"Polygon","coordinates":[[[123.7406121043902,13.12873334794429],[123.7406412762299,13.12868766866198],[123.7406562066809,13.12865137358145],[123.7406665141622,13.12857789560582],[123.7406698631599,13.12855482306406],[123.7406945232056,13.12854830358827],[123.7412478937839,13.12849912978002],[123.7415008793705,13.12847132505726],[123.7415041700287,13.12849750663191],[123.7415096692245,13.12902640559171],[123.74108839363,13.12906780110058],[123.7408293370436,13.12909000950886],[123.7406919013151,13.12909264770115],[123.7406706013298,13.1290847847856],[123.7406441417552,13.12907039246089],[123.7406247145984,13.12904951525065],[123.7406044681364,13.12901703816797],[123.7405401489314,13.12882240980647],[123.7406121043902,13.12873334794429]]]}$geojson$), 4326)::extensions.geography) returning area_id into area_id_value;
  else
    update public.area set area_name = 'Hawaiian Palm Garden', area_category = 'garden', boundary_geom = st_setsrid(st_geomfromgeojson($geojson${"type":"Polygon","coordinates":[[[123.7406121043902,13.12873334794429],[123.7406412762299,13.12868766866198],[123.7406562066809,13.12865137358145],[123.7406665141622,13.12857789560582],[123.7406698631599,13.12855482306406],[123.7406945232056,13.12854830358827],[123.7412478937839,13.12849912978002],[123.7415008793705,13.12847132505726],[123.7415041700287,13.12849750663191],[123.7415096692245,13.12902640559171],[123.74108839363,13.12906780110058],[123.7408293370436,13.12909000950886],[123.7406919013151,13.12909264770115],[123.7406706013298,13.1290847847856],[123.7406441417552,13.12907039246089],[123.7406247145984,13.12904951525065],[123.7406044681364,13.12901703816797],[123.7405401489314,13.12882240980647],[123.7406121043902,13.12873334794429]]]}$geojson$), 4326)::extensions.geography where area_id = area_id_value;
  end if;
  select area_id into area_id_value from public.area where site_id = 1 and area_code = 'DPG' limit 1;
  if area_id_value is null then
    insert into public.area (site_id, area_code, area_name, area_category, boundary_geom) values (1, 'DPG', 'Dates Palm Garden', 'garden', st_setsrid(st_geomfromgeojson($geojson${"type":"Polygon","coordinates":[[[123.7398135678771,13.12850151092343],[123.7397498144484,13.12850154906577],[123.7397133365944,13.12847477736388],[123.7396930646815,13.12838949138012],[123.7397288214942,13.12836459529402],[123.7398216251688,13.12831759389227],[123.7400198362306,13.1282367966545],[123.7401067638377,13.12821468399574],[123.7401919434392,13.12818730562433],[123.7402554922226,13.12817632170536],[123.7402941730351,13.12815726357629],[123.7403265845668,13.12812766645202],[123.7403704721411,13.12813941732078],[123.7404220079671,13.1281522471567],[123.7404631202201,13.12819374379407],[123.7404899213332,13.12823987551977],[123.7405277495677,13.12836244204297],[123.7405737992595,13.12849325396437],[123.7406111922961,13.12862098644719],[123.7405993113786,13.12865583994522],[123.740576692005,13.12868794042411],[123.7405209393491,13.12875850121638],[123.7405000063252,13.12876589519994],[123.7403169730559,13.12854362903269],[123.7402063519015,13.12852939473058],[123.7398135678771,13.12850151092343]]]}$geojson$), 4326)::extensions.geography) returning area_id into area_id_value;
  else
    update public.area set area_name = 'Dates Palm Garden', area_category = 'garden', boundary_geom = st_setsrid(st_geomfromgeojson($geojson${"type":"Polygon","coordinates":[[[123.7398135678771,13.12850151092343],[123.7397498144484,13.12850154906577],[123.7397133365944,13.12847477736388],[123.7396930646815,13.12838949138012],[123.7397288214942,13.12836459529402],[123.7398216251688,13.12831759389227],[123.7400198362306,13.1282367966545],[123.7401067638377,13.12821468399574],[123.7401919434392,13.12818730562433],[123.7402554922226,13.12817632170536],[123.7402941730351,13.12815726357629],[123.7403265845668,13.12812766645202],[123.7403704721411,13.12813941732078],[123.7404220079671,13.1281522471567],[123.7404631202201,13.12819374379407],[123.7404899213332,13.12823987551977],[123.7405277495677,13.12836244204297],[123.7405737992595,13.12849325396437],[123.7406111922961,13.12862098644719],[123.7405993113786,13.12865583994522],[123.740576692005,13.12868794042411],[123.7405209393491,13.12875850121638],[123.7405000063252,13.12876589519994],[123.7403169730559,13.12854362903269],[123.7402063519015,13.12852939473058],[123.7398135678771,13.12850151092343]]]}$geojson$), 4326)::extensions.geography where area_id = area_id_value;
  end if;
  select area_id into area_id_value from public.area where site_id = 1 and area_code = 'YPG' limit 1;
  if area_id_value is null then
    insert into public.area (site_id, area_code, area_name, area_category, boundary_geom) values (1, 'YPG', 'Yellow Palm Garden', 'garden', st_setsrid(st_geomfromgeojson($geojson${"type":"Polygon","coordinates":[[[123.7415689093597,13.12902139180967],[123.7415525600624,13.12860433367676],[123.7415616435514,13.12825715732427],[123.7415614653796,13.12822846176834],[123.7416006616914,13.12823833554374],[123.7422543920873,13.12850944393344],[123.7422746225039,13.12855377340774],[123.7422846588012,13.12893205644994],[123.742249964703,13.12894907134266],[123.7421931102673,13.12895746120152],[123.7415689093597,13.12902139180967]]]}$geojson$), 4326)::extensions.geography) returning area_id into area_id_value;
  else
    update public.area set area_name = 'Yellow Palm Garden', area_category = 'garden', boundary_geom = st_setsrid(st_geomfromgeojson($geojson${"type":"Polygon","coordinates":[[[123.7415689093597,13.12902139180967],[123.7415525600624,13.12860433367676],[123.7415616435514,13.12825715732427],[123.7415614653796,13.12822846176834],[123.7416006616914,13.12823833554374],[123.7422543920873,13.12850944393344],[123.7422746225039,13.12855377340774],[123.7422846588012,13.12893205644994],[123.742249964703,13.12894907134266],[123.7421931102673,13.12895746120152],[123.7415689093597,13.12902139180967]]]}$geojson$), 4326)::extensions.geography where area_id = area_id_value;
  end if;
end $$;

create temporary table _phase1_node_map (source_id text primary key, node_id bigint not null) on commit drop;

do $$
declare matched_node_id bigint;
begin
  select node_id into matched_node_id from public.map_node where site_id = 1 and node_name = 'Royal Palm Junction' and node_type = 'junction' and location_geom is not null and st_dwithin(location_geom, st_setsrid(st_geomfromgeojson($geojson${"type":"Point","coordinates":[123.740628344391,13.12853063908331]}$geojson$), 4326)::extensions.geography, 0.5) limit 1;
  if matched_node_id is null then
    insert into public.map_node (site_id, node_name, node_type, location_geom) values (1, 'Royal Palm Junction', 'junction', st_setsrid(st_geomfromgeojson($geojson${"type":"Point","coordinates":[123.740628344391,13.12853063908331]}$geojson$), 4326)::extensions.geography) returning node_id into matched_node_id;
  end if;
  insert into _phase1_node_map (source_id, node_id) values ('N001', matched_node_id) on conflict (source_id) do update set node_id = excluded.node_id;
end $$;

do $$
declare matched_node_id bigint;
begin
  select node_id into matched_node_id from public.map_node where site_id = 1 and node_name = 'Royal Palm Junction' and node_type = 'junction' and location_geom is not null and st_dwithin(location_geom, st_setsrid(st_geomfromgeojson($geojson${"type":"Point","coordinates":[123.7415273207423,13.12843559705057]}$geojson$), 4326)::extensions.geography, 0.5) limit 1;
  if matched_node_id is null then
    insert into public.map_node (site_id, node_name, node_type, location_geom) values (1, 'Royal Palm Junction', 'junction', st_setsrid(st_geomfromgeojson($geojson${"type":"Point","coordinates":[123.7415273207423,13.12843559705057]}$geojson$), 4326)::extensions.geography) returning node_id into matched_node_id;
  end if;
  insert into _phase1_node_map (source_id, node_id) values ('N002', matched_node_id) on conflict (source_id) do update set node_id = excluded.node_id;
end $$;

do $$
declare matched_node_id bigint;
begin
  select node_id into matched_node_id from public.map_node where site_id = 1 and node_name = 'Royal Palm Landmark' and node_type = 'landmark' and location_geom is not null and st_dwithin(location_geom, st_setsrid(st_geomfromgeojson($geojson${"type":"Point","coordinates":[123.7410898523541,13.12823832624933]}$geojson$), 4326)::extensions.geography, 0.5) limit 1;
  if matched_node_id is null then
    insert into public.map_node (site_id, node_name, node_type, location_geom) values (1, 'Royal Palm Landmark', 'landmark', st_setsrid(st_geomfromgeojson($geojson${"type":"Point","coordinates":[123.7410898523541,13.12823832624933]}$geojson$), 4326)::extensions.geography) returning node_id into matched_node_id;
  end if;
  insert into _phase1_node_map (source_id, node_id) values ('N003', matched_node_id) on conflict (source_id) do update set node_id = excluded.node_id;
end $$;

do $$
declare matched_node_id bigint;
begin
  select node_id into matched_node_id from public.map_node where site_id = 1 and node_name = 'Main Entrance' and node_type = 'entrance' and location_geom is not null and st_dwithin(location_geom, st_setsrid(st_geomfromgeojson($geojson${"type":"Point","coordinates":[123.739711436971,13.12801316723383]}$geojson$), 4326)::extensions.geography, 0.5) limit 1;
  if matched_node_id is null then
    insert into public.map_node (site_id, node_name, node_type, location_geom) values (1, 'Main Entrance', 'entrance', st_setsrid(st_geomfromgeojson($geojson${"type":"Point","coordinates":[123.739711436971,13.12801316723383]}$geojson$), 4326)::extensions.geography) returning node_id into matched_node_id;
  end if;
  insert into _phase1_node_map (source_id, node_id) values ('N004', matched_node_id) on conflict (source_id) do update set node_id = excluded.node_id;
end $$;

do $$
declare matched_node_id bigint;
begin
  select node_id into matched_node_id from public.map_node where site_id = 1 and node_name = 'Main Exit' and node_type = 'junction' and location_geom is not null and st_dwithin(location_geom, st_setsrid(st_geomfromgeojson($geojson${"type":"Point","coordinates":[123.7415512254145,13.12772432667477]}$geojson$), 4326)::extensions.geography, 0.5) limit 1;
  if matched_node_id is null then
    insert into public.map_node (site_id, node_name, node_type, location_geom) values (1, 'Main Exit', 'junction', st_setsrid(st_geomfromgeojson($geojson${"type":"Point","coordinates":[123.7415512254145,13.12772432667477]}$geojson$), 4326)::extensions.geography) returning node_id into matched_node_id;
  end if;
  insert into _phase1_node_map (source_id, node_id) values ('N005', matched_node_id) on conflict (source_id) do update set node_id = excluded.node_id;
end $$;

do $$
declare matched_node_id bigint;
begin
  select node_id into matched_node_id from public.map_node where site_id = 1 and node_name = 'Royal Palm Junction' and node_type = 'junction' and location_geom is not null and st_dwithin(location_geom, st_setsrid(st_geomfromgeojson($geojson${"type":"Point","coordinates":[123.741536644377,13.12818940150263]}$geojson$), 4326)::extensions.geography, 0.5) limit 1;
  if matched_node_id is null then
    insert into public.map_node (site_id, node_name, node_type, location_geom) values (1, 'Royal Palm Junction', 'junction', st_setsrid(st_geomfromgeojson($geojson${"type":"Point","coordinates":[123.741536644377,13.12818940150263]}$geojson$), 4326)::extensions.geography) returning node_id into matched_node_id;
  end if;
  insert into _phase1_node_map (source_id, node_id) values ('N006', matched_node_id) on conflict (source_id) do update set node_id = excluded.node_id;
end $$;

do $$
declare matched_node_id bigint;
begin
  select node_id into matched_node_id from public.map_node where site_id = 1 and node_name = 'Royal Palm Junction' and node_type = 'junction' and location_geom is not null and st_dwithin(location_geom, st_setsrid(st_geomfromgeojson($geojson${"type":"Point","coordinates":[123.7402766825385,13.12808698630982]}$geojson$), 4326)::extensions.geography, 0.5) limit 1;
  if matched_node_id is null then
    insert into public.map_node (site_id, node_name, node_type, location_geom) values (1, 'Royal Palm Junction', 'junction', st_setsrid(st_geomfromgeojson($geojson${"type":"Point","coordinates":[123.7402766825385,13.12808698630982]}$geojson$), 4326)::extensions.geography) returning node_id into matched_node_id;
  end if;
  insert into _phase1_node_map (source_id, node_id) values ('N007', matched_node_id) on conflict (source_id) do update set node_id = excluded.node_id;
end $$;

do $$
declare matched_node_id bigint;
begin
  select node_id into matched_node_id from public.map_node where site_id = 1 and node_name = 'Dates Palm Junction' and node_type = 'junction' and location_geom is not null and st_dwithin(location_geom, st_setsrid(st_geomfromgeojson($geojson${"type":"Point","coordinates":[123.740502504532,13.12881097525611]}$geojson$), 4326)::extensions.geography, 0.5) limit 1;
  if matched_node_id is null then
    insert into public.map_node (site_id, node_name, node_type, location_geom) values (1, 'Dates Palm Junction', 'junction', st_setsrid(st_geomfromgeojson($geojson${"type":"Point","coordinates":[123.740502504532,13.12881097525611]}$geojson$), 4326)::extensions.geography) returning node_id into matched_node_id;
  end if;
  insert into _phase1_node_map (source_id, node_id) values ('N008', matched_node_id) on conflict (source_id) do update set node_id = excluded.node_id;
end $$;

do $$
declare matched_node_id bigint;
begin
  select node_id into matched_node_id from public.map_node where site_id = 1 and node_name = 'Hawaiian Palm Junction' and node_type = 'junction' and location_geom is not null and st_dwithin(location_geom, st_setsrid(st_geomfromgeojson($geojson${"type":"Point","coordinates":[123.7415394842868,13.12903431284176]}$geojson$), 4326)::extensions.geography, 0.5) limit 1;
  if matched_node_id is null then
    insert into public.map_node (site_id, node_name, node_type, location_geom) values (1, 'Hawaiian Palm Junction', 'junction', st_setsrid(st_geomfromgeojson($geojson${"type":"Point","coordinates":[123.7415394842868,13.12903431284176]}$geojson$), 4326)::extensions.geography) returning node_id into matched_node_id;
  end if;
  insert into _phase1_node_map (source_id, node_id) values ('N009', matched_node_id) on conflict (source_id) do update set node_id = excluded.node_id;
end $$;

do $$
declare matched_node_id bigint;
begin
  select node_id into matched_node_id from public.map_node where site_id = 1 and node_name = 'Royal Palm Cross' and node_type = 'junction' and location_geom is not null and st_dwithin(location_geom, st_setsrid(st_geomfromgeojson($geojson${"type":"Point","coordinates":[123.741119288143,13.12800019120587]}$geojson$), 4326)::extensions.geography, 0.5) limit 1;
  if matched_node_id is null then
    insert into public.map_node (site_id, node_name, node_type, location_geom) values (1, 'Royal Palm Cross', 'junction', st_setsrid(st_geomfromgeojson($geojson${"type":"Point","coordinates":[123.741119288143,13.12800019120587]}$geojson$), 4326)::extensions.geography) returning node_id into matched_node_id;
  end if;
  insert into _phase1_node_map (source_id, node_id) values ('N010', matched_node_id) on conflict (source_id) do update set node_id = excluded.node_id;
end $$;

do $$
declare matched_node_id bigint;
begin
  select node_id into matched_node_id from public.map_node where site_id = 1 and node_name = 'Hawaiian Palm Landmark' and node_type = 'junction' and location_geom is not null and st_dwithin(location_geom, st_setsrid(st_geomfromgeojson($geojson${"type":"Point","coordinates":[123.741064521153,13.12879879596171]}$geojson$), 4326)::extensions.geography, 0.5) limit 1;
  if matched_node_id is null then
    insert into public.map_node (site_id, node_name, node_type, location_geom) values (1, 'Hawaiian Palm Landmark', 'junction', st_setsrid(st_geomfromgeojson($geojson${"type":"Point","coordinates":[123.741064521153,13.12879879596171]}$geojson$), 4326)::extensions.geography) returning node_id into matched_node_id;
  end if;
  insert into _phase1_node_map (source_id, node_id) values ('N011', matched_node_id) on conflict (source_id) do update set node_id = excluded.node_id;
end $$;

do $$
declare matched_node_id bigint;
begin
  select node_id into matched_node_id from public.map_node where site_id = 1 and node_name = 'Yellow Palm Landmark' and node_type = 'junction' and location_geom is not null and st_dwithin(location_geom, st_setsrid(st_geomfromgeojson($geojson${"type":"Point","coordinates":[123.741939127178,13.12862518257746]}$geojson$), 4326)::extensions.geography, 0.5) limit 1;
  if matched_node_id is null then
    insert into public.map_node (site_id, node_name, node_type, location_geom) values (1, 'Yellow Palm Landmark', 'junction', st_setsrid(st_geomfromgeojson($geojson${"type":"Point","coordinates":[123.741939127178,13.12862518257746]}$geojson$), 4326)::extensions.geography) returning node_id into matched_node_id;
  end if;
  insert into _phase1_node_map (source_id, node_id) values ('N012', matched_node_id) on conflict (source_id) do update set node_id = excluded.node_id;
end $$;

do $$
declare matched_node_id bigint;
begin
  select node_id into matched_node_id from public.map_node where site_id = 1 and node_name = 'Royal Palm Junction' and node_type = 'junction' and location_geom is not null and st_dwithin(location_geom, st_setsrid(st_geomfromgeojson($geojson${"type":"Point","coordinates":[123.7402688445091,13.12799022125917]}$geojson$), 4326)::extensions.geography, 0.5) limit 1;
  if matched_node_id is null then
    insert into public.map_node (site_id, node_name, node_type, location_geom) values (1, 'Royal Palm Junction', 'junction', st_setsrid(st_geomfromgeojson($geojson${"type":"Point","coordinates":[123.7402688445091,13.12799022125917]}$geojson$), 4326)::extensions.geography) returning node_id into matched_node_id;
  end if;
  insert into _phase1_node_map (source_id, node_id) values ('N013', matched_node_id) on conflict (source_id) do update set node_id = excluded.node_id;
end $$;

do $$
declare matched_node_id bigint;
begin
  select node_id into matched_node_id from public.map_node where site_id = 1 and node_name = 'Derived junction 014' and node_type = 'junction' and location_geom is not null and st_dwithin(location_geom, st_setsrid(st_geomfromgeojson($geojson${"type":"Point","coordinates":[123.74067641318726,13.12826285121816]}$geojson$), 4326)::extensions.geography, 0.5) limit 1;
  if matched_node_id is null then
    insert into public.map_node (site_id, node_name, node_type, location_geom) values (1, 'Derived junction 014', 'junction', st_setsrid(st_geomfromgeojson($geojson${"type":"Point","coordinates":[123.74067641318726,13.12826285121816]}$geojson$), 4326)::extensions.geography) returning node_id into matched_node_id;
  end if;
  insert into _phase1_node_map (source_id, node_id) values ('N014', matched_node_id) on conflict (source_id) do update set node_id = excluded.node_id;
end $$;

do $$
declare matched_node_id bigint;
begin
  select node_id into matched_node_id from public.map_node where site_id = 1 and node_name = 'Derived edge endpoint (N015)' and node_type = 'junction' and location_geom is not null and st_dwithin(location_geom, st_setsrid(st_geomfromgeojson($geojson${"type":"Point","coordinates":[123.7411038120985,13.12845638635186]}$geojson$), 4326)::extensions.geography, 0.5) limit 1;
  if matched_node_id is null then
    insert into public.map_node (site_id, node_name, node_type, location_geom) values (1, 'Derived edge endpoint (N015)', 'junction', st_setsrid(st_geomfromgeojson($geojson${"type":"Point","coordinates":[123.7411038120985,13.12845638635186]}$geojson$), 4326)::extensions.geography) returning node_id into matched_node_id;
  end if;
  insert into _phase1_node_map (source_id, node_id) values ('N015', matched_node_id) on conflict (source_id) do update set node_id = excluded.node_id;
end $$;

do $$
declare matched_node_id bigint;
begin
  select node_id into matched_node_id from public.map_node where site_id = 1 and node_name = 'Derived edge endpoint (N016)' and node_type = 'junction' and location_geom is not null and st_dwithin(location_geom, st_setsrid(st_geomfromgeojson($geojson${"type":"Point","coordinates":[123.7410913777065,13.12827804533663]}$geojson$), 4326)::extensions.geography, 0.5) limit 1;
  if matched_node_id is null then
    insert into public.map_node (site_id, node_name, node_type, location_geom) values (1, 'Derived edge endpoint (N016)', 'junction', st_setsrid(st_geomfromgeojson($geojson${"type":"Point","coordinates":[123.7410913777065,13.12827804533663]}$geojson$), 4326)::extensions.geography) returning node_id into matched_node_id;
  end if;
  insert into _phase1_node_map (source_id, node_id) values ('N016', matched_node_id) on conflict (source_id) do update set node_id = excluded.node_id;
end $$;

do $$
declare matched_node_id bigint;
begin
  select node_id into matched_node_id from public.map_node where site_id = 1 and node_name = 'Derived edge endpoint (N017)' and node_type = 'junction' and location_geom is not null and st_dwithin(location_geom, st_setsrid(st_geomfromgeojson($geojson${"type":"Point","coordinates":[123.7407437563408,13.12848669992525]}$geojson$), 4326)::extensions.geography, 0.5) limit 1;
  if matched_node_id is null then
    insert into public.map_node (site_id, node_name, node_type, location_geom) values (1, 'Derived edge endpoint (N017)', 'junction', st_setsrid(st_geomfromgeojson($geojson${"type":"Point","coordinates":[123.7407437563408,13.12848669992525]}$geojson$), 4326)::extensions.geography) returning node_id into matched_node_id;
  end if;
  insert into _phase1_node_map (source_id, node_id) values ('N017', matched_node_id) on conflict (source_id) do update set node_id = excluded.node_id;
end $$;

do $$
declare matched_node_id bigint;
begin
  select node_id into matched_node_id from public.map_node where site_id = 1 and node_name = 'Derived edge endpoint (N018)' and node_type = 'junction' and location_geom is not null and st_dwithin(location_geom, st_setsrid(st_geomfromgeojson($geojson${"type":"Point","coordinates":[123.7406191701803,13.12806895323293]}$geojson$), 4326)::extensions.geography, 0.5) limit 1;
  if matched_node_id is null then
    insert into public.map_node (site_id, node_name, node_type, location_geom) values (1, 'Derived edge endpoint (N018)', 'junction', st_setsrid(st_geomfromgeojson($geojson${"type":"Point","coordinates":[123.7406191701803,13.12806895323293]}$geojson$), 4326)::extensions.geography) returning node_id into matched_node_id;
  end if;
  insert into _phase1_node_map (source_id, node_id) values ('N018', matched_node_id) on conflict (source_id) do update set node_id = excluded.node_id;
end $$;

do $$
declare matched_node_id bigint;
begin
  select node_id into matched_node_id from public.map_node where site_id = 1 and node_name = 'Derived edge endpoint (N019)' and node_type = 'junction' and location_geom is not null and st_dwithin(location_geom, st_setsrid(st_geomfromgeojson($geojson${"type":"Point","coordinates":[123.7410586019583,13.12824302766891]}$geojson$), 4326)::extensions.geography, 0.5) limit 1;
  if matched_node_id is null then
    insert into public.map_node (site_id, node_name, node_type, location_geom) values (1, 'Derived edge endpoint (N019)', 'junction', st_setsrid(st_geomfromgeojson($geojson${"type":"Point","coordinates":[123.7410586019583,13.12824302766891]}$geojson$), 4326)::extensions.geography) returning node_id into matched_node_id;
  end if;
  insert into _phase1_node_map (source_id, node_id) values ('N019', matched_node_id) on conflict (source_id) do update set node_id = excluded.node_id;
end $$;

do $$
declare matched_node_id bigint;
begin
  select node_id into matched_node_id from public.map_node where site_id = 1 and node_name = 'Derived edge endpoint (N020)' and node_type = 'junction' and location_geom is not null and st_dwithin(location_geom, st_setsrid(st_geomfromgeojson($geojson${"type":"Point","coordinates":[123.7410829816531,13.12820458724272]}$geojson$), 4326)::extensions.geography, 0.5) limit 1;
  if matched_node_id is null then
    insert into public.map_node (site_id, node_name, node_type, location_geom) values (1, 'Derived edge endpoint (N020)', 'junction', st_setsrid(st_geomfromgeojson($geojson${"type":"Point","coordinates":[123.7410829816531,13.12820458724272]}$geojson$), 4326)::extensions.geography) returning node_id into matched_node_id;
  end if;
  insert into _phase1_node_map (source_id, node_id) values ('N020', matched_node_id) on conflict (source_id) do update set node_id = excluded.node_id;
end $$;

do $$
declare matched_node_id bigint;
begin
  select node_id into matched_node_id from public.map_node where site_id = 1 and node_name = 'Derived edge endpoint (N021)' and node_type = 'junction' and location_geom is not null and st_dwithin(location_geom, st_setsrid(st_geomfromgeojson($geojson${"type":"Point","coordinates":[123.7411036713225,13.12794129821973]}$geojson$), 4326)::extensions.geography, 0.5) limit 1;
  if matched_node_id is null then
    insert into public.map_node (site_id, node_name, node_type, location_geom) values (1, 'Derived edge endpoint (N021)', 'junction', st_setsrid(st_geomfromgeojson($geojson${"type":"Point","coordinates":[123.7411036713225,13.12794129821973]}$geojson$), 4326)::extensions.geography) returning node_id into matched_node_id;
  end if;
  insert into _phase1_node_map (source_id, node_id) values ('N021', matched_node_id) on conflict (source_id) do update set node_id = excluded.node_id;
end $$;

do $$
declare matched_node_id bigint;
begin
  select node_id into matched_node_id from public.map_node where site_id = 1 and node_name = 'Derived edge endpoint (N022)' and node_type = 'junction' and location_geom is not null and st_dwithin(location_geom, st_setsrid(st_geomfromgeojson($geojson${"type":"Point","coordinates":[123.7411210258106,13.12823370366797]}$geojson$), 4326)::extensions.geography, 0.5) limit 1;
  if matched_node_id is null then
    insert into public.map_node (site_id, node_name, node_type, location_geom) values (1, 'Derived edge endpoint (N022)', 'junction', st_setsrid(st_geomfromgeojson($geojson${"type":"Point","coordinates":[123.7411210258106,13.12823370366797]}$geojson$), 4326)::extensions.geography) returning node_id into matched_node_id;
  end if;
  insert into _phase1_node_map (source_id, node_id) values ('N022', matched_node_id) on conflict (source_id) do update set node_id = excluded.node_id;
end $$;

do $$
declare matched_node_id bigint;
begin
  select node_id into matched_node_id from public.map_node where site_id = 1 and node_name = 'Derived edge endpoint (N023)' and node_type = 'junction' and location_geom is not null and st_dwithin(location_geom, st_setsrid(st_geomfromgeojson($geojson${"type":"Point","coordinates":[123.7415097127076,13.12819138231603]}$geojson$), 4326)::extensions.geography, 0.5) limit 1;
  if matched_node_id is null then
    insert into public.map_node (site_id, node_name, node_type, location_geom) values (1, 'Derived edge endpoint (N023)', 'junction', st_setsrid(st_geomfromgeojson($geojson${"type":"Point","coordinates":[123.7415097127076,13.12819138231603]}$geojson$), 4326)::extensions.geography) returning node_id into matched_node_id;
  end if;
  insert into _phase1_node_map (source_id, node_id) values ('N023', matched_node_id) on conflict (source_id) do update set node_id = excluded.node_id;
end $$;

do $$
declare matched_node_id bigint;
begin
  select node_id into matched_node_id from public.map_node where site_id = 1 and node_name = 'Derived edge endpoint (N024)' and node_type = 'junction' and location_geom is not null and st_dwithin(location_geom, st_setsrid(st_geomfromgeojson($geojson${"type":"Point","coordinates":[123.7410296297591,13.12879412177239]}$geojson$), 4326)::extensions.geography, 0.5) limit 1;
  if matched_node_id is null then
    insert into public.map_node (site_id, node_name, node_type, location_geom) values (1, 'Derived edge endpoint (N024)', 'junction', st_setsrid(st_geomfromgeojson($geojson${"type":"Point","coordinates":[123.7410296297591,13.12879412177239]}$geojson$), 4326)::extensions.geography) returning node_id into matched_node_id;
  end if;
  insert into _phase1_node_map (source_id, node_id) values ('N024', matched_node_id) on conflict (source_id) do update set node_id = excluded.node_id;
end $$;

do $$
declare matched_node_id bigint;
begin
  select node_id into matched_node_id from public.map_node where site_id = 1 and node_name = 'Derived edge endpoint (N025)' and node_type = 'junction' and location_geom is not null and st_dwithin(location_geom, st_setsrid(st_geomfromgeojson($geojson${"type":"Point","coordinates":[123.7405567062705,13.12884564554591]}$geojson$), 4326)::extensions.geography, 0.5) limit 1;
  if matched_node_id is null then
    insert into public.map_node (site_id, node_name, node_type, location_geom) values (1, 'Derived edge endpoint (N025)', 'junction', st_setsrid(st_geomfromgeojson($geojson${"type":"Point","coordinates":[123.7405567062705,13.12884564554591]}$geojson$), 4326)::extensions.geography) returning node_id into matched_node_id;
  end if;
  insert into _phase1_node_map (source_id, node_id) values ('N025', matched_node_id) on conflict (source_id) do update set node_id = excluded.node_id;
end $$;

do $$
declare matched_node_id bigint;
begin
  select node_id into matched_node_id from public.map_node where site_id = 1 and node_name = 'Derived edge endpoint (N026)' and node_type = 'junction' and location_geom is not null and st_dwithin(location_geom, st_setsrid(st_geomfromgeojson($geojson${"type":"Point","coordinates":[123.7410663920915,13.12883058569264]}$geojson$), 4326)::extensions.geography, 0.5) limit 1;
  if matched_node_id is null then
    insert into public.map_node (site_id, node_name, node_type, location_geom) values (1, 'Derived edge endpoint (N026)', 'junction', st_setsrid(st_geomfromgeojson($geojson${"type":"Point","coordinates":[123.7410663920915,13.12883058569264]}$geojson$), 4326)::extensions.geography) returning node_id into matched_node_id;
  end if;
  insert into _phase1_node_map (source_id, node_id) values ('N026', matched_node_id) on conflict (source_id) do update set node_id = excluded.node_id;
end $$;

do $$
declare matched_node_id bigint;
begin
  select node_id into matched_node_id from public.map_node where site_id = 1 and node_name = 'Derived edge endpoint (N027)' and node_type = 'junction' and location_geom is not null and st_dwithin(location_geom, st_setsrid(st_geomfromgeojson($geojson${"type":"Point","coordinates":[123.7410914578424,13.12906599056837]}$geojson$), 4326)::extensions.geography, 0.5) limit 1;
  if matched_node_id is null then
    insert into public.map_node (site_id, node_name, node_type, location_geom) values (1, 'Derived edge endpoint (N027)', 'junction', st_setsrid(st_geomfromgeojson($geojson${"type":"Point","coordinates":[123.7410914578424,13.12906599056837]}$geojson$), 4326)::extensions.geography) returning node_id into matched_node_id;
  end if;
  insert into _phase1_node_map (source_id, node_id) values ('N027', matched_node_id) on conflict (source_id) do update set node_id = excluded.node_id;
end $$;

do $$
declare matched_node_id bigint;
begin
  select node_id into matched_node_id from public.map_node where site_id = 1 and node_name = 'Derived edge endpoint (N028)' and node_type = 'junction' and location_geom is not null and st_dwithin(location_geom, st_setsrid(st_geomfromgeojson($geojson${"type":"Point","coordinates":[123.7410943889899,13.12878641535624]}$geojson$), 4326)::extensions.geography, 0.5) limit 1;
  if matched_node_id is null then
    insert into public.map_node (site_id, node_name, node_type, location_geom) values (1, 'Derived edge endpoint (N028)', 'junction', st_setsrid(st_geomfromgeojson($geojson${"type":"Point","coordinates":[123.7410943889899,13.12878641535624]}$geojson$), 4326)::extensions.geography) returning node_id into matched_node_id;
  end if;
  insert into _phase1_node_map (source_id, node_id) values ('N028', matched_node_id) on conflict (source_id) do update set node_id = excluded.node_id;
end $$;

do $$
declare matched_node_id bigint;
begin
  select node_id into matched_node_id from public.map_node where site_id = 1 and node_name = 'Derived edge endpoint (N029)' and node_type = 'junction' and location_geom is not null and st_dwithin(location_geom, st_setsrid(st_geomfromgeojson($geojson${"type":"Point","coordinates":[123.7415015811615,13.12873921939796]}$geojson$), 4326)::extensions.geography, 0.5) limit 1;
  if matched_node_id is null then
    insert into public.map_node (site_id, node_name, node_type, location_geom) values (1, 'Derived edge endpoint (N029)', 'junction', st_setsrid(st_geomfromgeojson($geojson${"type":"Point","coordinates":[123.7415015811615,13.12873921939796]}$geojson$), 4326)::extensions.geography) returning node_id into matched_node_id;
  end if;
  insert into _phase1_node_map (source_id, node_id) values ('N029', matched_node_id) on conflict (source_id) do update set node_id = excluded.node_id;
end $$;

do $$
declare matched_node_id bigint;
begin
  select node_id into matched_node_id from public.map_node where site_id = 1 and node_name = 'Derived edge endpoint (N030)' and node_type = 'junction' and location_geom is not null and st_dwithin(location_geom, st_setsrid(st_geomfromgeojson($geojson${"type":"Point","coordinates":[123.7410577506299,13.12876742989936]}$geojson$), 4326)::extensions.geography, 0.5) limit 1;
  if matched_node_id is null then
    insert into public.map_node (site_id, node_name, node_type, location_geom) values (1, 'Derived edge endpoint (N030)', 'junction', st_setsrid(st_geomfromgeojson($geojson${"type":"Point","coordinates":[123.7410577506299,13.12876742989936]}$geojson$), 4326)::extensions.geography) returning node_id into matched_node_id;
  end if;
  insert into _phase1_node_map (source_id, node_id) values ('N030', matched_node_id) on conflict (source_id) do update set node_id = excluded.node_id;
end $$;

do $$
declare matched_node_id bigint;
begin
  select node_id into matched_node_id from public.map_node where site_id = 1 and node_name = 'Derived edge endpoint (N031)' and node_type = 'junction' and location_geom is not null and st_dwithin(location_geom, st_setsrid(st_geomfromgeojson($geojson${"type":"Point","coordinates":[123.7410319420409,13.12852876866479]}$geojson$), 4326)::extensions.geography, 0.5) limit 1;
  if matched_node_id is null then
    insert into public.map_node (site_id, node_name, node_type, location_geom) values (1, 'Derived edge endpoint (N031)', 'junction', st_setsrid(st_geomfromgeojson($geojson${"type":"Point","coordinates":[123.7410319420409,13.12852876866479]}$geojson$), 4326)::extensions.geography) returning node_id into matched_node_id;
  end if;
  insert into _phase1_node_map (source_id, node_id) values ('N031', matched_node_id) on conflict (source_id) do update set node_id = excluded.node_id;
end $$;

do $$
declare matched_node_id bigint;
begin
  select node_id into matched_node_id from public.map_node where site_id = 1 and node_name = 'Derived edge endpoint (N032)' and node_type = 'junction' and location_geom is not null and st_dwithin(location_geom, st_setsrid(st_geomfromgeojson($geojson${"type":"Point","coordinates":[123.741573835457,13.12893220839772]}$geojson$), 4326)::extensions.geography, 0.5) limit 1;
  if matched_node_id is null then
    insert into public.map_node (site_id, node_name, node_type, location_geom) values (1, 'Derived edge endpoint (N032)', 'junction', st_setsrid(st_geomfromgeojson($geojson${"type":"Point","coordinates":[123.741573835457,13.12893220839772]}$geojson$), 4326)::extensions.geography) returning node_id into matched_node_id;
  end if;
  insert into _phase1_node_map (source_id, node_id) values ('N032', matched_node_id) on conflict (source_id) do update set node_id = excluded.node_id;
end $$;

do $$
declare matched_node_id bigint;
begin
  select node_id into matched_node_id from public.map_node where site_id = 1 and node_name = 'Derived edge endpoint (N033)' and node_type = 'junction' and location_geom is not null and st_dwithin(location_geom, st_setsrid(st_geomfromgeojson($geojson${"type":"Point","coordinates":[123.7422755173042,13.12886425340776]}$geojson$), 4326)::extensions.geography, 0.5) limit 1;
  if matched_node_id is null then
    insert into public.map_node (site_id, node_name, node_type, location_geom) values (1, 'Derived edge endpoint (N033)', 'junction', st_setsrid(st_geomfromgeojson($geojson${"type":"Point","coordinates":[123.7422755173042,13.12886425340776]}$geojson$), 4326)::extensions.geography) returning node_id into matched_node_id;
  end if;
  insert into _phase1_node_map (source_id, node_id) values ('N033', matched_node_id) on conflict (source_id) do update set node_id = excluded.node_id;
end $$;

do $$
declare matched_node_id bigint;
begin
  select node_id into matched_node_id from public.map_node where site_id = 1 and node_name = 'Derived edge endpoint (N034)' and node_type = 'junction' and location_geom is not null and st_dwithin(location_geom, st_setsrid(st_geomfromgeojson($geojson${"type":"Point","coordinates":[123.7419366147827,13.12866285650484]}$geojson$), 4326)::extensions.geography, 0.5) limit 1;
  if matched_node_id is null then
    insert into public.map_node (site_id, node_name, node_type, location_geom) values (1, 'Derived edge endpoint (N034)', 'junction', st_setsrid(st_geomfromgeojson($geojson${"type":"Point","coordinates":[123.7419366147827,13.12866285650484]}$geojson$), 4326)::extensions.geography) returning node_id into matched_node_id;
  end if;
  insert into _phase1_node_map (source_id, node_id) values ('N034', matched_node_id) on conflict (source_id) do update set node_id = excluded.node_id;
end $$;

do $$
declare matched_node_id bigint;
begin
  select node_id into matched_node_id from public.map_node where site_id = 1 and node_name = 'Derived edge endpoint (N035)' and node_type = 'junction' and location_geom is not null and st_dwithin(location_geom, st_setsrid(st_geomfromgeojson($geojson${"type":"Point","coordinates":[123.7419421506023,13.12889272218984]}$geojson$), 4326)::extensions.geography, 0.5) limit 1;
  if matched_node_id is null then
    insert into public.map_node (site_id, node_name, node_type, location_geom) values (1, 'Derived edge endpoint (N035)', 'junction', st_setsrid(st_geomfromgeojson($geojson${"type":"Point","coordinates":[123.7419421506023,13.12889272218984]}$geojson$), 4326)::extensions.geography) returning node_id into matched_node_id;
  end if;
  insert into _phase1_node_map (source_id, node_id) values ('N035', matched_node_id) on conflict (source_id) do update set node_id = excluded.node_id;
end $$;

do $$
declare matched_node_id bigint;
begin
  select node_id into matched_node_id from public.map_node where site_id = 1 and node_name = 'Derived edge endpoint (N036)' and node_type = 'junction' and location_geom is not null and st_dwithin(location_geom, st_setsrid(st_geomfromgeojson($geojson${"type":"Point","coordinates":[123.7419104118998,13.12862527905005]}$geojson$), 4326)::extensions.geography, 0.5) limit 1;
  if matched_node_id is null then
    insert into public.map_node (site_id, node_name, node_type, location_geom) values (1, 'Derived edge endpoint (N036)', 'junction', st_setsrid(st_geomfromgeojson($geojson${"type":"Point","coordinates":[123.7419104118998,13.12862527905005]}$geojson$), 4326)::extensions.geography) returning node_id into matched_node_id;
  end if;
  insert into _phase1_node_map (source_id, node_id) values ('N036', matched_node_id) on conflict (source_id) do update set node_id = excluded.node_id;
end $$;

do $$
declare matched_node_id bigint;
begin
  select node_id into matched_node_id from public.map_node where site_id = 1 and node_name = 'Derived edge endpoint (N037)' and node_type = 'junction' and location_geom is not null and st_dwithin(location_geom, st_setsrid(st_geomfromgeojson($geojson${"type":"Point","coordinates":[123.7415561335953,13.12862919411653]}$geojson$), 4326)::extensions.geography, 0.5) limit 1;
  if matched_node_id is null then
    insert into public.map_node (site_id, node_name, node_type, location_geom) values (1, 'Derived edge endpoint (N037)', 'junction', st_setsrid(st_geomfromgeojson($geojson${"type":"Point","coordinates":[123.7415561335953,13.12862919411653]}$geojson$), 4326)::extensions.geography) returning node_id into matched_node_id;
  end if;
  insert into _phase1_node_map (source_id, node_id) values ('N037', matched_node_id) on conflict (source_id) do update set node_id = excluded.node_id;
end $$;

do $$
declare matched_node_id bigint;
begin
  select node_id into matched_node_id from public.map_node where site_id = 1 and node_name = 'Derived edge endpoint (N038)' and node_type = 'junction' and location_geom is not null and st_dwithin(location_geom, st_setsrid(st_geomfromgeojson($geojson${"type":"Point","coordinates":[123.7419729722561,13.12862538973531]}$geojson$), 4326)::extensions.geography, 0.5) limit 1;
  if matched_node_id is null then
    insert into public.map_node (site_id, node_name, node_type, location_geom) values (1, 'Derived edge endpoint (N038)', 'junction', st_setsrid(st_geomfromgeojson($geojson${"type":"Point","coordinates":[123.7419729722561,13.12862538973531]}$geojson$), 4326)::extensions.geography) returning node_id into matched_node_id;
  end if;
  insert into _phase1_node_map (source_id, node_id) values ('N038', matched_node_id) on conflict (source_id) do update set node_id = excluded.node_id;
end $$;

do $$
declare matched_node_id bigint;
begin
  select node_id into matched_node_id from public.map_node where site_id = 1 and node_name = 'Derived edge endpoint (N039)' and node_type = 'junction' and location_geom is not null and st_dwithin(location_geom, st_setsrid(st_geomfromgeojson($geojson${"type":"Point","coordinates":[123.7422707228544,13.12862567178184]}$geojson$), 4326)::extensions.geography, 0.5) limit 1;
  if matched_node_id is null then
    insert into public.map_node (site_id, node_name, node_type, location_geom) values (1, 'Derived edge endpoint (N039)', 'junction', st_setsrid(st_geomfromgeojson($geojson${"type":"Point","coordinates":[123.7422707228544,13.12862567178184]}$geojson$), 4326)::extensions.geography) returning node_id into matched_node_id;
  end if;
  insert into _phase1_node_map (source_id, node_id) values ('N039', matched_node_id) on conflict (source_id) do update set node_id = excluded.node_id;
end $$;

do $$
declare matched_node_id bigint;
begin
  select node_id into matched_node_id from public.map_node where site_id = 1 and node_name = 'Derived edge endpoint (N040)' and node_type = 'junction' and location_geom is not null and st_dwithin(location_geom, st_setsrid(st_geomfromgeojson($geojson${"type":"Point","coordinates":[123.7419382171864,13.12860247231768]}$geojson$), 4326)::extensions.geography, 0.5) limit 1;
  if matched_node_id is null then
    insert into public.map_node (site_id, node_name, node_type, location_geom) values (1, 'Derived edge endpoint (N040)', 'junction', st_setsrid(st_geomfromgeojson($geojson${"type":"Point","coordinates":[123.7419382171864,13.12860247231768]}$geojson$), 4326)::extensions.geography) returning node_id into matched_node_id;
  end if;
  insert into _phase1_node_map (source_id, node_id) values ('N040', matched_node_id) on conflict (source_id) do update set node_id = excluded.node_id;
end $$;

do $$
declare matched_node_id bigint;
begin
  select node_id into matched_node_id from public.map_node where site_id = 1 and node_name = 'Derived edge endpoint (N041)' and node_type = 'junction' and location_geom is not null and st_dwithin(location_geom, st_setsrid(st_geomfromgeojson($geojson${"type":"Point","coordinates":[123.741942596372,13.12838490674422]}$geojson$), 4326)::extensions.geography, 0.5) limit 1;
  if matched_node_id is null then
    insert into public.map_node (site_id, node_name, node_type, location_geom) values (1, 'Derived edge endpoint (N041)', 'junction', st_setsrid(st_geomfromgeojson($geojson${"type":"Point","coordinates":[123.741942596372,13.12838490674422]}$geojson$), 4326)::extensions.geography) returning node_id into matched_node_id;
  end if;
  insert into _phase1_node_map (source_id, node_id) values ('N041', matched_node_id) on conflict (source_id) do update set node_id = excluded.node_id;
end $$;

do $$
declare from_id bigint; to_id bigint; geometry_value extensions.geography; already_exists boolean;
begin
  select node_id into from_id from _phase1_node_map where source_id = 'N015';
  select node_id into to_id from _phase1_node_map where source_id = 'N016';
  geometry_value := st_setsrid(st_geomfromgeojson($geojson${"type":"LineString","coordinates":[[123.7411038120985,13.12845638635186],[123.7410913777065,13.12827804533663]]}$geojson$), 4326)::extensions.geography;
  if from_id is null or to_id is null or from_id = to_id then raise exception 'Missing or invalid node mapping for Phase 1 edge'; end if;
  select exists(select 1 from public.map_edge where from_node_id = from_id and to_node_id = to_id and edge_type = 'path' and path_geom is not null and st_dwithin(path_geom, geometry_value, 0.5)) into already_exists;
  if not already_exists then
    insert into public.map_edge (from_node_id, to_node_id, path_geom, distance_m, edge_type, is_restricted) values (from_id, to_id, geometry_value, st_length(geometry_value), 'path', false);
  end if;
end $$;

do $$
declare from_id bigint; to_id bigint; geometry_value extensions.geography; already_exists boolean;
begin
  select node_id into from_id from _phase1_node_map where source_id = 'N017';
  select node_id into to_id from _phase1_node_map where source_id = 'N018';
  geometry_value := st_setsrid(st_geomfromgeojson($geojson${"type":"LineString","coordinates":[[123.7407437563408,13.12848669992525],[123.7406766861297,13.12826377575012],[123.7406191701803,13.12806895323293]]}$geojson$), 4326)::extensions.geography;
  if from_id is null or to_id is null or from_id = to_id then raise exception 'Missing or invalid node mapping for Phase 1 edge'; end if;
  select exists(select 1 from public.map_edge where from_node_id = from_id and to_node_id = to_id and edge_type = 'path' and path_geom is not null and st_dwithin(path_geom, geometry_value, 0.5)) into already_exists;
  if not already_exists then
    insert into public.map_edge (from_node_id, to_node_id, path_geom, distance_m, edge_type, is_restricted) values (from_id, to_id, geometry_value, st_length(geometry_value), 'path', false);
  end if;
end $$;

do $$
declare from_id bigint; to_id bigint; geometry_value extensions.geography; already_exists boolean;
begin
  select node_id into from_id from _phase1_node_map where source_id = 'N014';
  select node_id into to_id from _phase1_node_map where source_id = 'N019';
  geometry_value := st_setsrid(st_geomfromgeojson($geojson${"type":"LineString","coordinates":[[123.7406758046639,13.12826288278134],[123.7410586019583,13.12824302766891]]}$geojson$), 4326)::extensions.geography;
  if from_id is null or to_id is null or from_id = to_id then raise exception 'Missing or invalid node mapping for Phase 1 edge'; end if;
  select exists(select 1 from public.map_edge where from_node_id = from_id and to_node_id = to_id and edge_type = 'path' and path_geom is not null and st_dwithin(path_geom, geometry_value, 0.5)) into already_exists;
  if not already_exists then
    insert into public.map_edge (from_node_id, to_node_id, path_geom, distance_m, edge_type, is_restricted) values (from_id, to_id, geometry_value, st_length(geometry_value), 'path', false);
  end if;
end $$;

do $$
declare from_id bigint; to_id bigint; geometry_value extensions.geography; already_exists boolean;
begin
  select node_id into from_id from _phase1_node_map where source_id = 'N020';
  select node_id into to_id from _phase1_node_map where source_id = 'N021';
  geometry_value := st_setsrid(st_geomfromgeojson($geojson${"type":"LineString","coordinates":[[123.7410829816531,13.12820458724272],[123.7410678839943,13.12801068950536],[123.7410851564649,13.12799518223994],[123.7410807209723,13.12797308966474],[123.7410911492804,13.12795888981274],[123.7411051009502,13.12795341293118],[123.7411036713225,13.12794129821973]]}$geojson$), 4326)::extensions.geography;
  if from_id is null or to_id is null or from_id = to_id then raise exception 'Missing or invalid node mapping for Phase 1 edge'; end if;
  select exists(select 1 from public.map_edge where from_node_id = from_id and to_node_id = to_id and edge_type = 'path' and path_geom is not null and st_dwithin(path_geom, geometry_value, 0.5)) into already_exists;
  if not already_exists then
    insert into public.map_edge (from_node_id, to_node_id, path_geom, distance_m, edge_type, is_restricted) values (from_id, to_id, geometry_value, st_length(geometry_value), 'path', false);
  end if;
end $$;

do $$
declare from_id bigint; to_id bigint; geometry_value extensions.geography; already_exists boolean;
begin
  select node_id into from_id from _phase1_node_map where source_id = 'N022';
  select node_id into to_id from _phase1_node_map where source_id = 'N023';
  geometry_value := st_setsrid(st_geomfromgeojson($geojson${"type":"LineString","coordinates":[[123.7411210258106,13.12823370366797],[123.7412184214383,13.12822663773535],[123.7413150867108,13.12821880609869],[123.7414128768224,13.12820538204031],[123.7415097127076,13.12819138231603]]}$geojson$), 4326)::extensions.geography;
  if from_id is null or to_id is null or from_id = to_id then raise exception 'Missing or invalid node mapping for Phase 1 edge'; end if;
  select exists(select 1 from public.map_edge where from_node_id = from_id and to_node_id = to_id and edge_type = 'path' and path_geom is not null and st_dwithin(path_geom, geometry_value, 0.5)) into already_exists;
  if not already_exists then
    insert into public.map_edge (from_node_id, to_node_id, path_geom, distance_m, edge_type, is_restricted) values (from_id, to_id, geometry_value, st_length(geometry_value), 'path', false);
  end if;
end $$;

do $$
declare from_id bigint; to_id bigint; geometry_value extensions.geography; already_exists boolean;
begin
  select node_id into from_id from _phase1_node_map where source_id = 'N024';
  select node_id into to_id from _phase1_node_map where source_id = 'N025';
  geometry_value := st_setsrid(st_geomfromgeojson($geojson${"type":"LineString","coordinates":[[123.7410296297591,13.12879412177239],[123.7405567062705,13.12884564554591]]}$geojson$), 4326)::extensions.geography;
  if from_id is null or to_id is null or from_id = to_id then raise exception 'Missing or invalid node mapping for Phase 1 edge'; end if;
  select exists(select 1 from public.map_edge where from_node_id = from_id and to_node_id = to_id and edge_type = 'path' and path_geom is not null and st_dwithin(path_geom, geometry_value, 0.5)) into already_exists;
  if not already_exists then
    insert into public.map_edge (from_node_id, to_node_id, path_geom, distance_m, edge_type, is_restricted) values (from_id, to_id, geometry_value, st_length(geometry_value), 'path', false);
  end if;
end $$;

do $$
declare from_id bigint; to_id bigint; geometry_value extensions.geography; already_exists boolean;
begin
  select node_id into from_id from _phase1_node_map where source_id = 'N026';
  select node_id into to_id from _phase1_node_map where source_id = 'N027';
  geometry_value := st_setsrid(st_geomfromgeojson($geojson${"type":"LineString","coordinates":[[123.7410663920915,13.12883058569264],[123.7410914578424,13.12906599056837]]}$geojson$), 4326)::extensions.geography;
  if from_id is null or to_id is null or from_id = to_id then raise exception 'Missing or invalid node mapping for Phase 1 edge'; end if;
  select exists(select 1 from public.map_edge where from_node_id = from_id and to_node_id = to_id and edge_type = 'path' and path_geom is not null and st_dwithin(path_geom, geometry_value, 0.5)) into already_exists;
  if not already_exists then
    insert into public.map_edge (from_node_id, to_node_id, path_geom, distance_m, edge_type, is_restricted) values (from_id, to_id, geometry_value, st_length(geometry_value), 'path', false);
  end if;
end $$;

do $$
declare from_id bigint; to_id bigint; geometry_value extensions.geography; already_exists boolean;
begin
  select node_id into from_id from _phase1_node_map where source_id = 'N028';
  select node_id into to_id from _phase1_node_map where source_id = 'N029';
  geometry_value := st_setsrid(st_geomfromgeojson($geojson${"type":"LineString","coordinates":[[123.7410943889899,13.12878641535624],[123.7415015811615,13.12873921939796]]}$geojson$), 4326)::extensions.geography;
  if from_id is null or to_id is null or from_id = to_id then raise exception 'Missing or invalid node mapping for Phase 1 edge'; end if;
  select exists(select 1 from public.map_edge where from_node_id = from_id and to_node_id = to_id and edge_type = 'path' and path_geom is not null and st_dwithin(path_geom, geometry_value, 0.5)) into already_exists;
  if not already_exists then
    insert into public.map_edge (from_node_id, to_node_id, path_geom, distance_m, edge_type, is_restricted) values (from_id, to_id, geometry_value, st_length(geometry_value), 'path', false);
  end if;
end $$;

do $$
declare from_id bigint; to_id bigint; geometry_value extensions.geography; already_exists boolean;
begin
  select node_id into from_id from _phase1_node_map where source_id = 'N030';
  select node_id into to_id from _phase1_node_map where source_id = 'N031';
  geometry_value := st_setsrid(st_geomfromgeojson($geojson${"type":"LineString","coordinates":[[123.7410577506299,13.12876742989936],[123.7410319420409,13.12852876866479]]}$geojson$), 4326)::extensions.geography;
  if from_id is null or to_id is null or from_id = to_id then raise exception 'Missing or invalid node mapping for Phase 1 edge'; end if;
  select exists(select 1 from public.map_edge where from_node_id = from_id and to_node_id = to_id and edge_type = 'path' and path_geom is not null and st_dwithin(path_geom, geometry_value, 0.5)) into already_exists;
  if not already_exists then
    insert into public.map_edge (from_node_id, to_node_id, path_geom, distance_m, edge_type, is_restricted) values (from_id, to_id, geometry_value, st_length(geometry_value), 'path', false);
  end if;
end $$;

do $$
declare from_id bigint; to_id bigint; geometry_value extensions.geography; already_exists boolean;
begin
  select node_id into from_id from _phase1_node_map where source_id = 'N032';
  select node_id into to_id from _phase1_node_map where source_id = 'N033';
  geometry_value := st_setsrid(st_geomfromgeojson($geojson${"type":"LineString","coordinates":[[123.741573835457,13.12893220839772],[123.7422755173042,13.12886425340776]]}$geojson$), 4326)::extensions.geography;
  if from_id is null or to_id is null or from_id = to_id then raise exception 'Missing or invalid node mapping for Phase 1 edge'; end if;
  select exists(select 1 from public.map_edge where from_node_id = from_id and to_node_id = to_id and edge_type = 'path' and path_geom is not null and st_dwithin(path_geom, geometry_value, 0.5)) into already_exists;
  if not already_exists then
    insert into public.map_edge (from_node_id, to_node_id, path_geom, distance_m, edge_type, is_restricted) values (from_id, to_id, geometry_value, st_length(geometry_value), 'path', false);
  end if;
end $$;

do $$
declare from_id bigint; to_id bigint; geometry_value extensions.geography; already_exists boolean;
begin
  select node_id into from_id from _phase1_node_map where source_id = 'N034';
  select node_id into to_id from _phase1_node_map where source_id = 'N035';
  geometry_value := st_setsrid(st_geomfromgeojson($geojson${"type":"LineString","coordinates":[[123.7419366147827,13.12866285650484],[123.7419421506023,13.12889272218984]]}$geojson$), 4326)::extensions.geography;
  if from_id is null or to_id is null or from_id = to_id then raise exception 'Missing or invalid node mapping for Phase 1 edge'; end if;
  select exists(select 1 from public.map_edge where from_node_id = from_id and to_node_id = to_id and edge_type = 'path' and path_geom is not null and st_dwithin(path_geom, geometry_value, 0.5)) into already_exists;
  if not already_exists then
    insert into public.map_edge (from_node_id, to_node_id, path_geom, distance_m, edge_type, is_restricted) values (from_id, to_id, geometry_value, st_length(geometry_value), 'path', false);
  end if;
end $$;

do $$
declare from_id bigint; to_id bigint; geometry_value extensions.geography; already_exists boolean;
begin
  select node_id into from_id from _phase1_node_map where source_id = 'N036';
  select node_id into to_id from _phase1_node_map where source_id = 'N037';
  geometry_value := st_setsrid(st_geomfromgeojson($geojson${"type":"LineString","coordinates":[[123.7419104118998,13.12862527905005],[123.7415561335953,13.12862919411653]]}$geojson$), 4326)::extensions.geography;
  if from_id is null or to_id is null or from_id = to_id then raise exception 'Missing or invalid node mapping for Phase 1 edge'; end if;
  select exists(select 1 from public.map_edge where from_node_id = from_id and to_node_id = to_id and edge_type = 'path' and path_geom is not null and st_dwithin(path_geom, geometry_value, 0.5)) into already_exists;
  if not already_exists then
    insert into public.map_edge (from_node_id, to_node_id, path_geom, distance_m, edge_type, is_restricted) values (from_id, to_id, geometry_value, st_length(geometry_value), 'path', false);
  end if;
end $$;

do $$
declare from_id bigint; to_id bigint; geometry_value extensions.geography; already_exists boolean;
begin
  select node_id into from_id from _phase1_node_map where source_id = 'N038';
  select node_id into to_id from _phase1_node_map where source_id = 'N039';
  geometry_value := st_setsrid(st_geomfromgeojson($geojson${"type":"LineString","coordinates":[[123.7419729722561,13.12862538973531],[123.7422707228544,13.12862567178184]]}$geojson$), 4326)::extensions.geography;
  if from_id is null or to_id is null or from_id = to_id then raise exception 'Missing or invalid node mapping for Phase 1 edge'; end if;
  select exists(select 1 from public.map_edge where from_node_id = from_id and to_node_id = to_id and edge_type = 'path' and path_geom is not null and st_dwithin(path_geom, geometry_value, 0.5)) into already_exists;
  if not already_exists then
    insert into public.map_edge (from_node_id, to_node_id, path_geom, distance_m, edge_type, is_restricted) values (from_id, to_id, geometry_value, st_length(geometry_value), 'path', false);
  end if;
end $$;

do $$
declare from_id bigint; to_id bigint; geometry_value extensions.geography; already_exists boolean;
begin
  select node_id into from_id from _phase1_node_map where source_id = 'N040';
  select node_id into to_id from _phase1_node_map where source_id = 'N041';
  geometry_value := st_setsrid(st_geomfromgeojson($geojson${"type":"LineString","coordinates":[[123.7419382171864,13.12860247231768],[123.741942596372,13.12838490674422]]}$geojson$), 4326)::extensions.geography;
  if from_id is null or to_id is null or from_id = to_id then raise exception 'Missing or invalid node mapping for Phase 1 edge'; end if;
  select exists(select 1 from public.map_edge where from_node_id = from_id and to_node_id = to_id and edge_type = 'path' and path_geom is not null and st_dwithin(path_geom, geometry_value, 0.5)) into already_exists;
  if not already_exists then
    insert into public.map_edge (from_node_id, to_node_id, path_geom, distance_m, edge_type, is_restricted) values (from_id, to_id, geometry_value, st_length(geometry_value), 'path', false);
  end if;
end $$;

do $$
declare from_id bigint; to_id bigint; geometry_value extensions.geography; already_exists boolean;
begin
  select node_id into from_id from _phase1_node_map where source_id = 'N004';
  select node_id into to_id from _phase1_node_map where source_id = 'N013';
  geometry_value := st_setsrid(st_geomfromgeojson($geojson${"type":"LineString","coordinates":[[123.7397112870844,13.12801380647635],[123.73977072649,13.12808280454901],[123.7398454959677,13.12807027669366],[123.740229109141,13.12794647249112],[123.7402710293218,13.12799829758109],[123.7402771917625,13.1280712789659],[123.7402606332397,13.12813256949534],[123.7400153387492,13.12820699852901],[123.7396818071203,13.12835577396909],[123.7396574387865,13.12839913422864],[123.739706816544,13.12852110923973],[123.7398023173485,13.12853685039488],[123.7402621309934,13.12856995940548],[123.7403985962141,13.12869665768937],[123.7405005150963,13.12881540457152],[123.7405633928761,13.12901679658876],[123.7406128162871,13.12909026539858],[123.7406755666294,13.12912496937015],[123.7407826917707,13.12912944187823],[123.7422068286358,13.12898337665594],[123.7422904940647,13.1289662051758],[123.7423228442603,13.12887177479097],[123.7423012204792,13.12855986599199],[123.742264729358,13.12847441843111],[123.7415367039778,13.12818257919808],[123.7415466706432,13.12786581449556],[123.7415510151604,13.12772507351489],[123.7414668924936,13.12776905249553],[123.7413298282025,13.12770755396005],[123.7412202239299,13.12781035503441],[123.741040309575,13.12791854766088],[123.7408784887237,13.12799195141249],[123.740751883595,13.12802246539821],[123.7406734063201,13.12803978961819],[123.7405731342115,13.12804076787716],[123.7404338806394,13.12803421332965],[123.7402691560207,13.12799078864284]]}$geojson$), 4326)::extensions.geography;
  if from_id is null or to_id is null or from_id = to_id then raise exception 'Missing or invalid node mapping for Phase 1 edge'; end if;
  select exists(select 1 from public.map_edge where from_node_id = from_id and to_node_id = to_id and edge_type = 'road' and path_geom is not null and st_dwithin(path_geom, geometry_value, 0.5)) into already_exists;
  if not already_exists then
    insert into public.map_edge (from_node_id, to_node_id, path_geom, distance_m, edge_type, is_restricted) values (from_id, to_id, geometry_value, st_length(geometry_value), 'road', false);
  end if;
end $$;

do $$
declare from_id bigint; to_id bigint; geometry_value extensions.geography; already_exists boolean;
begin
  select node_id into from_id from _phase1_node_map where source_id = 'N007';
  select node_id into to_id from _phase1_node_map where source_id = 'N008';
  geometry_value := st_setsrid(st_geomfromgeojson($geojson${"type":"LineString","coordinates":[[123.7402763318098,13.12808780714987],[123.7404266949776,13.12812742967773],[123.7405026232816,13.12819961248963],[123.7405980193756,13.12848306702616],[123.7406225454643,13.12853093319916],[123.7406345129928,13.12858201686928],[123.7406338038292,13.12864241376396],[123.7405850488708,13.12872714075295],[123.7405027920662,13.12881115440598]]}$geojson$), 4326)::extensions.geography;
  if from_id is null or to_id is null or from_id = to_id then raise exception 'Missing or invalid node mapping for Phase 1 edge'; end if;
  select exists(select 1 from public.map_edge where from_node_id = from_id and to_node_id = to_id and edge_type = 'road' and path_geom is not null and st_dwithin(path_geom, geometry_value, 0.5)) into already_exists;
  if not already_exists then
    insert into public.map_edge (from_node_id, to_node_id, path_geom, distance_m, edge_type, is_restricted) values (from_id, to_id, geometry_value, st_length(geometry_value), 'road', false);
  end if;
end $$;

do $$
declare from_id bigint; to_id bigint; geometry_value extensions.geography; already_exists boolean;
begin
  select node_id into from_id from _phase1_node_map where source_id = 'N001';
  select node_id into to_id from _phase1_node_map where source_id = 'N002';
  geometry_value := st_setsrid(st_geomfromgeojson($geojson${"type":"LineString","coordinates":[[123.7406288426815,13.12853092014226],[123.7408463128015,13.12850621571828],[123.7415269139454,13.12843619608978]]}$geojson$), 4326)::extensions.geography;
  if from_id is null or to_id is null or from_id = to_id then raise exception 'Missing or invalid node mapping for Phase 1 edge'; end if;
  select exists(select 1 from public.map_edge where from_node_id = from_id and to_node_id = to_id and edge_type = 'road' and path_geom is not null and st_dwithin(path_geom, geometry_value, 0.5)) into already_exists;
  if not already_exists then
    insert into public.map_edge (from_node_id, to_node_id, path_geom, distance_m, edge_type, is_restricted) values (from_id, to_id, geometry_value, st_length(geometry_value), 'road', false);
  end if;
end $$;

do $$
declare from_id bigint; to_id bigint; geometry_value extensions.geography; already_exists boolean;
begin
  select node_id into from_id from _phase1_node_map where source_id = 'N006';
  select node_id into to_id from _phase1_node_map where source_id = 'N009';
  geometry_value := st_setsrid(st_geomfromgeojson($geojson${"type":"LineString","coordinates":[[123.7415363550128,13.12818999489939],[123.7415311191783,13.1284408016469],[123.7415297304188,13.12862941754102],[123.7415320054693,13.12879103829396],[123.7415393276134,13.12903366393575]]}$geojson$), 4326)::extensions.geography;
  if from_id is null or to_id is null or from_id = to_id then raise exception 'Missing or invalid node mapping for Phase 1 edge'; end if;
  select exists(select 1 from public.map_edge where from_node_id = from_id and to_node_id = to_id and edge_type = 'road' and path_geom is not null and st_dwithin(path_geom, geometry_value, 0.5)) into already_exists;
  if not already_exists then
    insert into public.map_edge (from_node_id, to_node_id, path_geom, distance_m, edge_type, is_restricted) values (from_id, to_id, geometry_value, st_length(geometry_value), 'road', false);
  end if;
end $$;

-- Read-only verification before commit:
select count(*) as phase1_garden_rows from public.area where site_id = 1 and area_code in ('RPG', 'HPG', 'DPG', 'YPG');
select count(*) as phase1_map_nodes from public.map_node where site_id = 1;
select edge_type, count(*) as edge_count from public.map_edge where edge_type in ('road', 'path') group by edge_type order by edge_type;
-- If the checks are correct, run COMMIT. Otherwise run ROLLBACK.
commit;

-- Post-commit verification:
select site_id, st_geometrytype(boundary_geom::extensions.geometry) as boundary_type, st_srid(boundary_geom::extensions.geometry) as boundary_srid, st_isvalid(boundary_geom::extensions.geometry) as boundary_valid from public.site where site_id = 1;
select area_code, area_name, st_geometrytype(boundary_geom::extensions.geometry) as area_type, st_srid(boundary_geom::extensions.geometry) as area_srid, st_isvalid(boundary_geom::extensions.geometry) as area_valid from public.area where site_id = 1 and area_code in ('RPG', 'HPG', 'DPG', 'YPG') order by area_code;
