INSERT INTO organizations (id, name, country_code, plan_tier)
VALUES ('11111111-1111-1111-1111-111111111111', 'Chárter Austral & Pacífico', 'CL', 'b2b_fleet');

INSERT INTO vessels (id, org_id, name, registration_number, vessel_type, loa_meters, beam_meters, draft_meters, mast_height_meters, fuel_capacity_l, water_capacity_l, engine_hours_current)
VALUES ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'SV Albatros (Oceanis 41.1)', 'CB-4582', 'sailboat', 12.43, 4.20, 2.18, 18.50, 200, 330, 1420.5);

INSERT INTO vessel_systems_qr (id, vessel_id, qr_slug, system_name, category, compartment_location, quick_instructions)
VALUES 
('33333333-3333-3333-3333-333333333331', '22222222-2222-2222-2222-222222222222', 'yanmar-4jh57', 'Motor Yanmar 4JH57 (57 HP)', 'engine', 'Bajo escalera salón principal', '1. Verificar grifo de fondo agua salada abierto (palanca vertical). 2. Revisar nivel aceite y refrigerante. 3. Encender contacto, esperar precalentamiento y dar arranque.'),
('33333333-3333-3333-3333-333333333332', '22222222-2222-2222-2222-222222222222', 'jabsco-wc-popa', 'Baño Marino Jabsco Popa', 'plumbing_wc', 'Baño de popa estribor', 'NUNCA arrojar papel higiénico ni toallitas. Bombear 10 veces en modo Flush (palanca izquierda) y 10 veces en modo Dry (palanca derecha) al terminar.'),
('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'quick-windlass', 'Molinete de Ancla Quick 1000W', 'anchoring', 'Pozo de anclas proa', 'Operar SIEMPRE con el motor principal encendido a 1.200 RPM para evitar caída de voltaje. Asegurar cadena con boza antes de navegar.');

INSERT INTO inventory_items (vessel_id, qr_node_id, item_name, category, quantity, min_threshold, expiration_date)
VALUES 
('22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333331', 'Impulsor Bomba Agua Yanmar + Empaquetadura', 'repuestos_motor', 2, 1, NULL),
('22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333331', 'Filtro Combustible Racor R20P (10 micras)', 'repuestos_motor', 3, 2, NULL),
('22222222-2222-2222-2222-222222222222', NULL, 'Kit Bengalas Solas (4 Paracaídas + 4 Mano)', 'seguridad', 1, 1, '2027-08-15');

INSERT INTO voyages (id, vessel_id, title, status, departure_port, arrival_port, departure_at, magic_link_token, security_deposit_amount)
VALUES ('44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222', 'Travesía Chiloé - Isla Mechuque', 'checkin_pending', 'Marina Puerto Montt', 'Caleta Mechuque', NOW() + INTERVAL '1 day', 'demo-trip-albatros-2026', 3500.00);
