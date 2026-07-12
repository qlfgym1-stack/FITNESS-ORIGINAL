-- =============================================================
-- DEMO DATA GENERATION
-- Idempotent : ne crée pas de doublons si déjà exécuté
-- Utilise une transaction avec rollback automatique en cas d'erreur
-- Marque les données avec email '%@fitmanager.demo' et notes '[DEMO]'
-- =============================================================

DO $$
DECLARE
  v_org_id UUID;
  v_demo_email_pattern TEXT := '%@fitmanager.demo';
  v_already_seeded BOOLEAN;
  v_sub_count INT;
  v_staff_count INT;
  v_member_count INT;

  -- Algerian first names
  v_first_names TEXT[] := ARRAY['Mohamed','Ahmed','Ali','Hassan','Hussein','Abdelkader','Abdelaziz','Khaled','Karim','Farid','Sami','Walid','Nadir','Tarek','Rachid','Sofiane','Yacine','Amine','Reda','Bilal','Nassim','Zakaria','Lyes','Mourad','Hicham','Fouad','Djamel','Ayoub','Ismail','Abderrahmane','Said','Abdelmadjid','Abdellah','Brahim','Noureddine','Mokhtar','Slimane','Kamel','Riad','Merouane','Fatima','Aicha','Zahra','Khadija','Amina','Hafida','Nadia','Samira','Karima','Farida','Malika','Souad','Rachida','Salima','Louiza','Yamina','Zineb','Houria','Djamila','Safia','Nabila','Latifa','Assia','Keltoum','Fadhila','Halima','Chahrazad','Nassima','Meriem','Hayet','Nawel','Souhila','Lynda','Fatiha','Zohra','Saida','Radia','Wassila','Naima','Dalila','Nora','Samia','Farah','Ines','Sonia','Myriam','Nesrine','Amel'];
  v_last_names TEXT[] := ARRAY['Benali','Ahmed','Said','Ouali','Brahimi','Tahar','Mansouri','Slimani','Hamdi','Benyahia','Kaci','Khelifi','Toumi','Belkacem','Boualem','Yahiaoui','Khaldi','Moussa','Cherifi','Gacem','Ammari','Nacer','Sebbah','Mekki','Zerrouki','Benamor','Taleb','Bennabi','Menad','Bouallegue','Sahi','Guedjali','Zidane','Rahal','Mazari','Khebbache','Messaoudi','Chikh','Ait','Boumediène','Belhadj','Adimi','Kermiche','Bouchaib','Sari','Aliouat','Ladjimi','Malki','Tighilt','Djerbi','Benmoussa','Yala','Boucherit','Henni','Mekacher','Boukerch','Tabachi','Ouahab','Djouad','Soualhi','Messaada','Lakhdari','Sahraoui','Boudiaf','Mazouni','Benziane','Cherrak','Belaidi','Loucif','Chabane','Satha','Haddadi','Benguerba','Beghoul','Bensebaini','Aouar','Belkadi','Zemouri','Tibou','Bouzaher','Benyounes','Semaoui','Tazarine','Mokhtari','Boukerrou','Lamari','Chennouf','Boussad','Achi','Mouzaoui','Taieb','Benazzouz','Charef','Ayache','Mechri','Bessaha'];
  v_wilayas TEXT[] := ARRAY['Alger','Oran','Constantine','Annaba','Blida','Sétif','Tizi Ouzou','Béjaïa','Tlemcen','Sidi Bel Abbès','Batna','Skikda','Biskra','Chlef','Béchar','Médéa','Mostaganem','Aïn Oussara','El Oued','Guelma','Bordj Bou Arreridj','Laghouat','Bouira','Tébessa','Mila','Aïn Defla','Saïda','Oum El Bouaghi','Ghardaïa','Souk Ahras','Tipaza','Mascara','Jijel','Relizane','Tamanrasset','BBA','Khenchela','Naâma','Adrar','Illizi'];
  v_commune_prefix TEXT[] := ARRAY['Cité','Lotissement','Zone','Centre','Village','Quartier','Route','Rue','Impasse','Cité Universitaire','Domaine','Ferme','Plage','Forêt','Oasis','Palmeraie','Station','Hameau','Bourg','Dédale'];
  v_member_notes TEXT := '[DEMO] Donnée de démonstration';
  v_rfid_uid TEXT;
  v_member_status TEXT;
  v_sub_id UUID;
  v_sub_type_id UUID;
  v_final_id UUID;
  v_start_date DATE;
  v_end_date DATE;
  v_email_name TEXT;

  -- Arrays to hold generated UUIDs
  v_member_ids UUID[] := '{}';
  v_subscription_type_ids UUID[] := '{}';
  v_staff_ids UUID[] := '{}';
  v_product_ids UUID[] := '{}';
  v_supplier_ids UUID[] := '{}';
  v_session_id UUID;
  v_transaction_id UUID;
  v_purchase_order_id UUID;

  -- Staff role data
  v_staff_roles TEXT[];
  v_staff_services TEXT[];
  v_staff_functions TEXT[];
  v_staff_role TEXT;
  v_staff_role_idx INT;

  -- Course data
  v_course_names TEXT[] := ARRAY['Musculation','Cardio','CrossFit','HIIT','Boxe Française','Pilates','Yoga','Cycling','Stretching','Zumba'];
  v_course_durations TIME[] := ARRAY['01:00:00','00:45:00','01:00:00','00:45:00','01:30:00','01:00:00','01:00:00','00:45:00','01:00:00','01:00:00'];
  v_course_colors TEXT[] := ARRAY['#ef4444','#3b82f6','#f59e0b','#10b981','#8b5cf6','#ec4899','#06b6d4','#f97316','#84cc16','#6366f1'];
  v_course_start TIME[] := ARRAY['07:00:00','08:00:00','09:00:00','10:00:00','11:00:00','14:00:00','15:00:00','16:00:00','17:00:00','18:00:00'];
  v_course_id UUID;
  v_start_time TIME;
  v_end_time TIME;
  v_day INT;
  v_coach_idx INT;
  v_available_coaches UUID[] := '{}';
  v_coach_id UUID;
  v_course_rand INT;

  -- Product categories
  v_product_categories TEXT[] := ARRAY['Boissons','Compléments','Snacks','Vêtements','Accessoires','Équipement','Hygiène','Autre'];
  v_product_names TEXT[] := ARRAY['Eau 500ml','Eau 1.5L','Isotonic 500ml','Boisson énergétique','Barre protéinée','Shaker 600ml','Protéine Whey 1kg','BCAA 500g','Créditine 300g','Pré-workout 300g','Casquette','T-shirt sport','Short sport','Serviette microfibre','Gant de musculation','Ceinture lombaire','Kettlebell 8kg','Kettlebell 16kg','Corde à sauter','Tapis de sol 10mm','Élastique de résistance','Foam roller','Balle de massage','Genouillère','Poignée de traction','Sandwich poulet','Salade bowl','Jus d\'orange','Infusion','Banane'];
  v_product_prices DECIMAL[][] := ARRAY[
    ARRAY[50,25],ARRAY[100,55],ARRAY[120,65],ARRAY[150,80],ARRAY[200,100],
    ARRAY[500,250],ARRAY[4500,3000],ARRAY[2800,1800],ARRAY[1800,1200],ARRAY[2500,1600],
    ARRAY[800,400],ARRAY[1500,800],ARRAY[1800,1000],ARRAY[600,300],
    ARRAY[1200,600],ARRAY[2500,1500],ARRAY[3000,1800],ARRAY[4500,2800],
    ARRAY[800,400],ARRAY[1800,1000],ARRAY[400,200],ARRAY[1500,800],
    ARRAY[500,250],ARRAY[1500,800],ARRAY[2000,1000],ARRAY[350,200],
    ARRAY[500,300],ARRAY[200,100],ARRAY[100,50],ARRAY[50,30]
  ];
  v_prod_price DECIMAL;
  v_cost_price DECIMAL;
  v_stock_qty INT;
  v_category TEXT;
  v_prod_id UUID;
  v_cat_idx INT;

  -- Attendance generation
  v_att_check_in TIMESTAMPTZ;
  v_att_check_out TIMESTAMPTZ;
  v_att_day_offset INT;
  v_check_in_hour INT;
  v_check_in_min INT;
  v_duration_min INT;
  v_member_sub_count INT;
  v_member_idx INT;
  v_active_sub_status TEXT;

  -- POS transaction data
  v_item_count INT;
  v_item_json JSONB := '[]';
  v_subtotal DECIMAL;
  v_discount DECIMAL;
  v_trans_total DECIMAL;
  v_payment_method TEXT;
  v_member_sale UUID;

  -- Purchase order items JSON
  v_po_item_count INT;
  v_po_list JSONB := '[]';
  v_po_item RECORD;
  v_po_total DECIMAL;

  -- Counter
  i INT;
  j INT;
  k INT;
  rand_int INT;
  rand_int2 INT;
  rand_real DECIMAL;
  demo_email TEXT;
  random_first TEXT;
  random_last TEXT;
  member_phone TEXT;
  member_address TEXT;
  member_phone_prefix TEXT;

BEGIN
  -- =============================================================
  -- 1. GET OR CREATE DEMO ORGANIZATION
  -- =============================================================
  SELECT id INTO v_org_id FROM organizations WHERE slug = 'fitmanager-demo' LIMIT 1;
  IF v_org_id IS NULL THEN
    INSERT INTO organizations (name, slug, address, phone, email)
    VALUES ('FitManager Démo', 'fitmanager-demo', '123 Rue Didouche Mourad, Alger Centre', '0550 12 34 56', 'demo@fitmanager.dz')
    RETURNING id INTO v_org_id;
  END IF;

  -- =============================================================
  -- 2. CHECK IF ALREADY SEEDED (via settings)
  -- =============================================================
  SELECT EXISTS (
    SELECT 1 FROM settings WHERE organization_id = v_org_id AND key = 'demo_data_seeded' AND value = 'true'
  ) INTO v_already_seeded;

  IF v_already_seeded THEN
    RAISE NOTICE 'Données DEMO déjà générées. Pour réinitialiser, exécutez : SELECT reset_demo_data();';
    RETURN;
  END IF;

  -- =============================================================
  -- 3. SUBSCRIPTION TYPES (10)
  -- =============================================================
  RAISE NOTICE 'Création des types d''abonnement...';

  INSERT INTO subscription_types (organization_id, name, description, duration_days, price, max_classes)
  VALUES (v_org_id, 'Séance', 'Accès pour une séance unique', 1, 500, 1)
  RETURNING id INTO v_sub_type_id;
  v_subscription_type_ids := array_append(v_subscription_type_ids, v_sub_type_id);

  INSERT INTO subscription_types (organization_id, name, description, duration_days, price)
  VALUES (v_org_id, 'Journalier', 'Accès illimité pour une journée', 1, 800)
  RETURNING id INTO v_sub_type_id;
  v_subscription_type_ids := array_append(v_subscription_type_ids, v_sub_type_id);

  INSERT INTO subscription_types (organization_id, name, description, duration_days, price)
  VALUES (v_org_id, 'Hebdomadaire', 'Accès illimité pour une semaine', 7, 2500)
  RETURNING id INTO v_sub_type_id;
  v_subscription_type_ids := array_append(v_subscription_type_ids, v_sub_type_id);

  INSERT INTO subscription_types (organization_id, name, description, duration_days, price)
  VALUES (v_org_id, 'Mensuel', 'Abonnement mensuel standard', 30, 6000)
  RETURNING id INTO v_sub_type_id;
  v_subscription_type_ids := array_append(v_subscription_type_ids, v_sub_type_id);

  INSERT INTO subscription_types (organization_id, name, description, duration_days, price, max_classes)
  VALUES (v_org_id, 'Mensuel + Coach', 'Abonnement mensuel avec coaching personnalisé', 30, 9000, 8)
  RETURNING id INTO v_sub_type_id;
  v_subscription_type_ids := array_append(v_subscription_type_ids, v_sub_type_id);

  INSERT INTO subscription_types (organization_id, name, description, duration_days, price, max_classes)
  VALUES (v_org_id, 'Trimestriel', 'Abonnement trimestriel économique', 90, 15000, NULL)
  RETURNING id INTO v_sub_type_id;
  v_subscription_type_ids := array_append(v_subscription_type_ids, v_sub_type_id);

  INSERT INTO subscription_types (organization_id, name, description, duration_days, price, max_classes)
  VALUES (v_org_id, 'Semestriel', 'Abonnement semestriel très avantageux', 180, 25000, NULL)
  RETURNING id INTO v_sub_type_id;
  v_subscription_type_ids := array_append(v_subscription_type_ids, v_sub_type_id);

  INSERT INTO subscription_types (organization_id, name, description, duration_days, price, max_classes)
  VALUES (v_org_id, 'Annuel', 'Abonnement annuel premium', 365, 40000, NULL)
  RETURNING id INTO v_sub_type_id;
  v_subscription_type_ids := array_append(v_subscription_type_ids, v_sub_type_id);

  INSERT INTO subscription_types (organization_id, name, description, duration_days, price)
  VALUES (v_org_id, 'Étudiant', 'Tarif étudiant mensuel', 30, 3500)
  RETURNING id INTO v_sub_type_id;
  v_subscription_type_ids := array_append(v_subscription_type_ids, v_sub_type_id);

  INSERT INTO subscription_types (organization_id, name, description, duration_days, price)
  VALUES (v_org_id, 'VIP', 'Accès illimité + tous les services premium', 30, 15000)
  RETURNING id INTO v_sub_type_id;
  v_subscription_type_ids := array_append(v_subscription_type_ids, v_sub_type_id);

  GET DIAGNOSTICS v_sub_count = ROW_COUNT;

  -- =============================================================
  -- 4. STAFF (100 employés)
  -- =============================================================
  RAISE NOTICE 'Création du personnel...';

  -- Staff config: 14 roles with counts
  v_staff_roles := ARRAY[
    'Directeur|Direction Générale|Directeur Général|1',
    'Gérant|Direction|Gérant|1',
    'Assistant|Direction|Assistant de Direction|2',
    'Réceptionniste|Accueil|Réceptionniste|12',
    'Coach Sportif Homme|Coaching|Coach Musculation|25',
    'Coach Sportif Femme|Coaching|Coach Fitness|15',
    'Comptable|Finance|Comptable|5',
    'Responsable RH|Ressources Humaines|Responsable RH|3',
    'Agent de Sécurité|Sécurité|Agent de Sécurité|10',
    'Femme de Ménage|Entretien|Femme de Ménage|12',
    'Agent d''Entretien|Entretien|Agent Technique|4',
    'Commercial|Commercial|Commercial Salle|3',
    'Technicien Maintenance|Technique|Technicien Maintenance|2',
    'Administratif|Administration|Employé Administratif|5'
  ];

  FOR i IN 1..array_length(v_staff_roles, 1) LOOP
    rand_int := (SELECT (string_to_array(v_staff_roles[i], '|'))[4]::INT);
    FOR j IN 1..rand_int LOOP
      random_first := v_first_names[1 + floor(random() * array_length(v_first_names, 1))::INT];
      random_last := v_last_names[1 + floor(random() * array_length(v_last_names, 1))::INT];
      demo_email := 'staff.' || lower(random_first) || '.' || lower(random_last) || '.' || (i*100 + j)::TEXT || '@fitmanager.demo';
      member_phone_prefix := ARRAY['0550','0551','0552','0553','0554','0555','0556','0557','0558','0559','0660','0661','0662','0663','0665','0666','0670','0671','0672','0770','0771','0772'][1 + floor(random() * 21)::INT];
      member_phone := member_phone_prefix || ' ' || LPAD((1 + floor(random() * 9999))::TEXT, 4, '0');

      INSERT INTO staff (organization_id, first_name, last_name, email, phone, role, salary, hire_date, is_active)
      VALUES (
        v_org_id, random_first, random_last, demo_email, member_phone,
        (string_to_array(v_staff_roles[i], '|'))[1],
        CASE
          WHEN i <= 2 THEN 80000 + floor(random() * 40000)
          WHEN i <= 3 THEN 45000 + floor(random() * 15000)
          WHEN i = 4 THEN 20000 + floor(random() * 5000)
          WHEN i IN (5,6) THEN 35000 + floor(random() * 15000)
          WHEN i IN (7,8,12) THEN 40000 + floor(random() * 10000)
          WHEN i = 9 THEN 25000 + floor(random() * 5000)
          WHEN i IN (10,11) THEN 18000 + floor(random() * 4000)
          WHEN i = 13 THEN 35000 + floor(random() * 5000)
          WHEN i = 14 THEN 28000 + floor(random() * 7000)
          ELSE 25000 + floor(random() * 10000)
        END,
        CURRENT_DATE - (30 + floor(random() * 800))::INT,
        true
      )
      RETURNING id INTO v_final_id;
      v_staff_ids := array_append(v_staff_ids, v_final_id);
    END LOOP;
  END LOOP;

  GET DIAGNOSTICS v_staff_count = ROW_COUNT;

  -- =============================================================
  -- 5. STAFF SHIFTS (2 weeks of shifts)
  -- =============================================================
  RAISE NOTICE 'Création des plannings du personnel...';

  FOR i IN 1..array_length(v_staff_ids, 1) LOOP
    FOR j IN 0..13 LOOP
      INSERT INTO staff_shifts (staff_id, organization_id, date, start_time, end_time, notes)
      VALUES (
        v_staff_ids[i], v_org_id,
        CURRENT_DATE + j,
        CASE WHEN floor(random() * 3) = 0 THEN '06:00:00'::TIME ELSE '08:00:00'::TIME END,
        CASE WHEN floor(random() * 3) = 0 THEN '14:00:00'::TIME ELSE '18:00:00'::TIME END,
        '[DEMO] Planning démo'
      );
    END LOOP;
  END LOOP;

  -- =============================================================
  -- 6. MEMBERS (300 adhérents)
  -- =============================================================
  RAISE NOTICE 'Création des adhérents...';

  FOR i IN 1..300 LOOP
    random_first := v_first_names[1 + floor(random() * array_length(v_first_names, 1))::INT];
    random_last := v_last_names[1 + floor(random() * array_length(v_last_names, 1))::INT];
    demo_email := 'member.' || lower(random_first) || '.' || lower(random_last) || '.' || i::TEXT || '@fitmanager.demo';
    member_phone_prefix := ARRAY['0550','0551','0552','0553','0554','0555','0556','0557','0558','0559','0660','0661','0662','0663','0665','0666','0670','0671','0672','0770','0771','0772'][1 + floor(random() * 21)::INT];
    member_phone := member_phone_prefix || LPAD((1 + floor(random() * 999999))::TEXT, 6, '0');
    member_address := v_commune_prefix[1 + floor(random() * array_length(v_commune_prefix, 1))::INT] || ' ' || (1+floor(random()*500))::TEXT || ', ' || v_wilayas[1+floor(random()*array_length(v_wilayas,1))::INT];
    rand_real := random();
    v_member_status := CASE
      WHEN rand_real < 0.65 THEN 'active'
      WHEN rand_real < 0.85 THEN 'inactive'
      WHEN rand_real < 0.93 THEN 'suspended'
      ELSE 'blocked'
    END;

    INSERT INTO members (
      organization_id, first_name, last_name, email, phone, gender,
      birth_date, address, emergency_contact, emergency_phone, photo_url,
      status, last_visit, notes
    ) VALUES (
      v_org_id, random_first, random_last, demo_email, member_phone,
      CASE WHEN random_first IN ('Fatima','Aicha','Zahra','Khadija','Amina','Hafida','Nadia','Samira','Karima','Farida','Malika','Souad','Rachida','Salima','Louiza','Yamina','Zineb','Houria','Djamila','Safia','Nabila','Latifa','Assia','Keltoum','Fadhila','Halima','Chahrazad','Nassima','Meriem','Hayet','Nawel','Souhila','Lynda','Fatiha','Zohra','Saida','Radia','Wassila','Naima','Dalila','Nora','Samia','Farah','Ines','Sonia','Myriam','Nesrine','Amel','Nassima') THEN 'female' ELSE 'male' END,
      CURRENT_DATE - (7000 + floor(random() * 12000))::INT,
      member_address,
      v_first_names[1 + floor(random() * array_length(v_first_names, 1))::INT] || ' ' || v_last_names[1 + floor(random() * array_length(v_last_names, 1))::INT],
      member_phone_prefix || LPAD((1 + floor(random() * 999999))::TEXT, 6, '0'),
      NULL,
      v_member_status,
      CASE WHEN v_member_status = 'active' THEN CURRENT_DATE - floor(random() * 30)::INT ELSE NULL END,
      v_member_notes
    )
    RETURNING id INTO v_final_id;
    v_member_ids := array_append(v_member_ids, v_final_id);
  END LOOP;

  GET DIAGNOSTICS v_member_count = ROW_COUNT;

  -- =============================================================
  -- 7. MEMBER SUBSCRIPTIONS
  -- =============================================================
  RAISE NOTICE 'Création des abonnements...';

  FOR i IN 1..array_length(v_member_ids, 1) LOOP
    rand_int := 1 + floor(random() * array_length(v_subscription_type_ids, 1))::INT;
    v_sub_type_id := v_subscription_type_ids[rand_int];
    rand_int2 := floor(random() * 120)::INT;
    v_start_date := CURRENT_DATE - rand_int2;
    rand_real := random();
    v_end_date := v_start_date + (SELECT duration_days FROM subscription_types WHERE id = v_sub_type_id);

    IF rand_real < 0.55 THEN
      v_active_sub_status := 'active';
      v_end_date := CURRENT_DATE + (10 + floor(random() * 60))::INT;
    ELSIF rand_real < 0.75 THEN
      v_active_sub_status := 'expired';
      v_end_date := CURRENT_DATE - (1 + floor(random() * 30))::INT;
    ELSIF rand_real < 0.88 THEN
      v_active_sub_status := 'active';
      v_end_date := CURRENT_DATE + (1 + floor(random() * 5))::INT;
    ELSIF rand_real < 0.95 THEN
      v_active_sub_status := 'cancelled';
    ELSE
      v_active_sub_status := 'pending_payment';
    END IF;

    INSERT INTO member_subscriptions (organization_id, member_id, subscription_type_id, start_date, end_date, total_amount, amount_paid, status)
    VALUES (
      v_org_id, v_member_ids[i], v_sub_type_id, v_start_date, v_end_date,
      (SELECT price FROM subscription_types WHERE id = v_sub_type_id),
      CASE WHEN v_active_sub_status IN ('active', 'expired') THEN (SELECT price FROM subscription_types WHERE id = v_sub_type_id) ELSE 0 END,
      v_active_sub_status
    )
    RETURNING id INTO v_final_id;
  END LOOP;

  -- =============================================================
  -- 8. RFID CARDS
  -- =============================================================
  RAISE NOTICE 'Création des badges RFID...';

  FOR i IN 1..array_length(v_member_ids, 1) LOOP
    v_rfid_uid := 'RF' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6)) || LPAD(i::TEXT, 4, '0');

    INSERT INTO rfid_cards (member_id, rfid_uid, status, assigned_at, notes, created_at, updated_at)
    VALUES (
      v_member_ids[i], v_rfid_uid, 'ACTIF',
      CURRENT_DATE - floor(random() * 90)::INT,
      v_member_notes,
      CURRENT_DATE - floor(random() * 90)::INT,
      CURRENT_DATE - floor(random() * 30)::INT
    );

    INSERT INTO rfid_audit_log (member_id, old_rfid_uid, new_rfid_uid, action, notes)
    VALUES (v_member_ids[i], NULL, v_rfid_uid, 'ASSIGN', v_member_notes);
  END LOOP;

  -- =============================================================
  -- 9. COURSES + SCHEDULES
  -- =============================================================
  RAISE NOTICE 'Création des cours et plannings...';

  -- Collect coach staff IDs
  SELECT ARRAY_AGG(id) INTO v_available_coaches
  FROM staff
  WHERE organization_id = v_org_id
    AND role LIKE 'Coach%'
    AND is_active = true;

  FOR i IN 1..array_length(v_course_names, 1) LOOP
    v_start_time := v_course_start[1 + floor(random() * array_length(v_course_start, 1))::INT];
    v_end_time := v_start_time + v_course_durations[1 + floor(random() * array_length(v_course_durations, 1))::INT]::INTERVAL;

    FOR v_day IN 0..6 LOOP
      v_coach_id := v_available_coaches[1 + floor(random() * array_length(v_available_coaches, 1))::INT];

      INSERT INTO classes (organization_id, name, description, coach_id, start_time, end_time, max_capacity, color, recurring, day_of_week)
      VALUES (
        v_org_id, v_course_names[i],
        'Cours de ' || v_course_names[i] || ' - Niveau débutant à avancé',
        v_coach_id, v_start_time, v_end_time,
        15 + floor(random() * 15)::INT,
        v_course_colors[i],
        true, v_day
      )
      RETURNING id INTO v_course_id;
    END LOOP;
  END LOOP;

  -- =============================================================
  -- 10. PRODUCTS (30 produits répartis dans 8 catégories)
  -- =============================================================
  RAISE NOTICE 'Création des produits POS...';

  FOR i IN 1..array_length(v_product_names, 1) LOOP
    v_cat_idx := CASE
      WHEN i <= 5 THEN 1
      WHEN i <= 10 THEN 2
      WHEN i <= 11 THEN 3
      WHEN i <= 15 THEN 4
      WHEN i <= 20 THEN 5
      WHEN i <= 21 THEN 3
      WHEN i <= 25 THEN 6
      ELSE 7
    END;
    v_prod_price := v_product_prices[i][1];
    v_cost_price := v_product_prices[i][2];
    v_stock_qty := 10 + floor(random() * 200)::INT;
    v_category := v_product_categories[v_cat_idx];

    INSERT INTO products (organization_id, name, category, price, cost, stock, barcode, is_active)
    VALUES (
      v_org_id, v_product_names[i], v_category, v_prod_price, v_cost_price, v_stock_qty,
      '250' || LPAD((700000 + i)::TEXT, 7, '0'), true
    )
    RETURNING id INTO v_final_id;
    v_product_ids := array_append(v_product_ids, v_final_id);
  END LOOP;

  -- =============================================================
  -- 11. SUPPLIERS
  -- =============================================================
  RAISE NOTICE 'Création des fournisseurs...';

  INSERT INTO suppliers (organization_id, name, contact_name, email, phone, address)
  VALUES
    (v_org_id, 'DistribAlim SPA', 'Karim Mansouri', 'contact@distribalim.dz', '0550 11 22 33', 'Zone Industrielle, Alger'),
    (v_org_id, 'SportWorld Algérie', 'Sami Bensalem', 'commandes@sportworld.dz', '0551 44 55 66', 'Lotissement les Pins, Oran'),
    (v_org_id, 'ProFit Distribution', 'Nadia Khelifi', 'info@profit-dz.com', '0552 77 88 99', 'Cité des Sports, Blida'),
    (v_org_id, 'NutriPlus SARL', 'Farid Bouzid', 'ventes@nutriplus.dz', '0660 11 22 33', 'Route de Sétif, Bordj Bou Arreridj'),
    (v_org_id, 'Equip Gym International', 'Hassan Taleb', 'h.taleb@equipgym.dz', '0661 44 55 66', 'Zone d''Activités, Constantine'),
    (v_org_id, 'NettPro Hygiène', 'Fatima Zidane', 'info@nettpro.dz', '0553 33 44 55', 'Cité Bellevue, Annaba'),
    (v_org_id, 'Boissons & Cie', 'Reda Ouali', 'r.ouali@boissonscie.dz', '0554 55 66 77', 'Zone Industrielle El Hadjar, Annaba'),
    (v_org_id, 'Tissu Sport SARL', 'Meriem Bouchareb', 'meriem@tissusport.dz', '0662 33 44 55', 'Quartier des Affaires, Tizi Ouzou')
  RETURNING id INTO v_final_id;
  v_supplier_ids := array_append(v_supplier_ids, v_final_id);

  -- =============================================================
  -- 12. INVENTORY + STOCK MOVEMENTS
  -- =============================================================
  RAISE NOTICE 'Création de l''inventaire...';

  FOR i IN 1..array_length(v_product_names, 1) LOOP
    INSERT INTO inventory (organization_id, name, category, quantity, unit, min_stock, price, supplier_id)
    VALUES (
      v_org_id, v_product_names[i], v_product_categories[
        CASE WHEN i <= 5 THEN 1 WHEN i <= 10 THEN 2 WHEN i <= 11 THEN 3
             WHEN i <= 15 THEN 4 WHEN i <= 20 THEN 5 WHEN i <= 25 THEN 6 ELSE 7 END
      ],
      50 + floor(random() * 500)::INT, 'unité', 10,
      v_product_prices[i][2],
      v_supplier_ids[1 + floor(random() * array_length(v_supplier_ids, 1))::INT]
    )
    RETURNING id INTO v_final_id;

    INSERT INTO stock_movements (inventory_id, organization_id, type, quantity, notes)
    VALUES (v_final_id, v_org_id, 'in', 50 + floor(random() * 500)::INT, '[DEMO] Stock initial');
  END LOOP;

  -- =============================================================
  -- 13. ATTENDANCE / RFID CHECK-INS (90 jours de données)
  -- =============================================================
  RAISE NOTICE 'Création des passages RFID...';

  FOR v_att_day_offset IN 0..89 LOOP
    FOR i IN 1..array_length(v_member_ids, 1) LOOP
      -- ~30% des membres viennent chaque jour (ceux avec abonnement actif)
      IF random() < 0.30 THEN
        v_check_in_hour := 6 + floor(random() * 13)::INT;
        v_check_in_min := floor(random() * 60)::INT;
        v_duration_min := 30 + floor(random() * 120)::INT;

        v_att_check_in := CURRENT_DATE - v_att_day_offset + (v_check_in_hour * 60 + v_check_in_min) * INTERVAL '1 minute';
        v_att_check_out := v_att_check_in + (v_duration_min * INTERVAL '1 minute');

        IF v_att_check_out > CURRENT_DATE - v_att_day_offset + '21:00:00'::INTERVAL THEN
          v_att_check_out := CURRENT_DATE - v_att_day_offset + '21:00:00'::INTERVAL;
        END IF;

        INSERT INTO attendance (organization_id, member_id, check_in, check_out, type, source)
        VALUES (v_org_id, v_member_ids[i], v_att_check_in, v_att_check_out, 'check-in', 'rfid');

        INSERT INTO rfid_read_logs (card_uid, member_id, terminal, event_type, result, read_at)
        VALUES (
          (SELECT rfid_uid FROM rfid_cards WHERE member_id = v_member_ids[i] AND status = 'ACTIF' LIMIT 1),
          v_member_ids[i],
          'Tourniquet ' || (1 + floor(random() * 3))::TEXT,
          'check-in', 'granted', v_att_check_in
        );
      END IF;
    END LOOP;
  END LOOP;

  -- =============================================================
  -- 14. POS SESSIONS + TRANSACTIONS (plusieurs centaines)
  -- =============================================================
  RAISE NOTICE 'Création des ventes POS...';

  FOR i IN 1..5 LOOP
    INSERT INTO pos_sessions (organization_id, staff_id, opened_at, closed_at, status, total)
    VALUES (
      v_org_id,
      v_staff_ids[1 + floor(random() * array_length(v_staff_ids, 1))::INT],
      CURRENT_DATE - (5-i) + '08:00:00'::INTERVAL,
      CURRENT_DATE - (5-i) + '20:00:00'::INTERVAL,
      'closed',
      0
    )
    RETURNING id INTO v_session_id;

    FOR j IN 1..(20 + floor(random() * 30))::INT LOOP
      v_item_count := 1 + floor(random() * 4)::INT;
      v_item_json := '[]';
      v_subtotal := 0;

      FOR k IN 1..v_item_count LOOP
        v_prod_id := v_product_ids[1 + floor(random() * array_length(v_product_ids, 1))::INT];
        rand_int := 1 + floor(random() * 3)::INT;
        SELECT price INTO rand_real FROM products WHERE id = v_prod_id;
        v_subtotal := v_subtotal + (rand_real * rand_int);
        v_item_json := v_item_json || jsonb_build_array(jsonb_build_object(
          'product_id', v_prod_id,
          'quantity', rand_int,
          'price', rand_real
        ));
      END LOOP;

      v_discount := CASE WHEN random() < 0.2 THEN floor(v_subtotal * random() * 0.2) ELSE 0 END;
      v_trans_total := v_subtotal - v_discount;
      v_payment_method := ARRAY['cash','card','transfer'][1 + floor(random() * 3)::INT];

      IF random() < 0.4 THEN
        v_member_sale := v_member_ids[1 + floor(random() * array_length(v_member_ids, 1))::INT];
      ELSE
        v_member_sale := NULL;
      END IF;

      INSERT INTO pos_transactions (session_id, organization_id, member_id, items, subtotal, discount, total, payment_method, payment_status, created_at)
      VALUES (
        v_session_id, v_org_id, v_member_sale, v_item_json,
        v_subtotal, v_discount, v_trans_total,
        v_payment_method, 'completed',
        CURRENT_DATE - (5-i) + '08:00:00'::INTERVAL + (j * interval '25 minutes')
      )
      RETURNING id INTO v_transaction_id;

      -- Update session total
      UPDATE pos_sessions SET total = COALESCE(total,0) + v_trans_total WHERE id = v_session_id;

      -- Decrement product stock
      FOR k IN 1..jsonb_array_length(v_item_json) LOOP
        UPDATE products SET stock = stock - (v_item_json->(k-1)->>'quantity')::INT
        WHERE id = (v_item_json->(k-1)->>'product_id')::UUID AND stock >= (v_item_json->(k-1)->>'quantity')::INT;
      END LOOP;
    END LOOP;
  END LOOP;

  -- =============================================================
  -- 15. PAYMENTS (liés aux abonnements)
  -- =============================================================
  RAISE NOTICE 'Création des paiements...';

  FOR i IN 1..array_length(v_member_ids, 1) LOOP
    -- ~70% des membres ont un paiement
    IF random() < 0.7 THEN
      rand_int := 1 + floor(random() * array_length(v_subscription_type_ids, 1))::INT;
      v_sub_type_id := v_subscription_type_ids[rand_int];
      SELECT price INTO rand_real FROM subscription_types WHERE id = v_sub_type_id;
      v_payment_method := ARRAY['cash','cash','card','transfer'][1 + floor(random() * 4)::INT];

      INSERT INTO payments (organization_id, member_id, amount, payment_method, payment_date, status, notes)
      VALUES (
        v_org_id, v_member_ids[i], rand_real, v_payment_method,
        CURRENT_DATE - floor(random() * 90)::INT,
        'completed', v_member_notes
      );
    END IF;
  END LOOP;

  -- =============================================================
  -- 16. PURCHASE ORDERS + STOCK MOVEMENTS
  -- =============================================================
  RAISE NOTICE 'Création des commandes fournisseurs...';

  FOR i IN 1..30 LOOP
    v_po_list := '[]';
    v_po_total := 0;
    v_po_item_count := 1 + floor(random() * 5)::INT;

    FOR k IN 1..v_po_item_count LOOP
      v_prod_id := v_product_ids[1 + floor(random() * array_length(v_product_ids, 1))::INT];
      rand_int := 5 + floor(random() * 50)::INT;
      SELECT cost INTO rand_real FROM products WHERE id = v_prod_id;
      v_po_total := v_po_total + (rand_real * rand_int);
      v_po_list := v_po_list || jsonb_build_array(jsonb_build_object('product_id', v_prod_id, 'quantity', rand_int, 'cost', rand_real));
    END LOOP;

    INSERT INTO purchase_orders (organization_id, supplier_id, order_date, status, total_amount, notes)
    VALUES (
      v_org_id,
      v_supplier_ids[1 + floor(random() * array_length(v_supplier_ids, 1))::INT],
      CURRENT_DATE - floor(random() * 60)::INT,
      CASE WHEN random() < 0.7 THEN 'received' ELSE 'pending' END,
      v_po_total, v_member_notes
    )
    RETURNING id INTO v_purchase_order_id;

    -- Stock movements for received orders
    IF random() < 0.7 THEN
      FOR k IN 1..jsonb_array_length(v_po_list) LOOP
        v_final_id := (v_po_list->(k-1)->>'product_id')::UUID;
        rand_int := (v_po_list->(k-1)->>'quantity')::INT;

        INSERT INTO stock_movements (inventory_id, organization_id, type, quantity, notes)
        VALUES (
          (SELECT id FROM inventory WHERE name = (SELECT name FROM products WHERE id = v_final_id) AND organization_id = v_org_id LIMIT 1),
          v_org_id, 'in', rand_int,
          '[DEMO] Réapprovisionnement commande #' || v_purchase_order_id
        );

        UPDATE products SET stock = COALESCE(stock,0) + rand_int WHERE id = v_final_id;
      END LOOP;
    END IF;
  END LOOP;

  -- =============================================================
  -- 17. MARK SEED COMPLETE
  -- =============================================================
  INSERT INTO settings (organization_id, key, value)
  VALUES (v_org_id, 'demo_data_seeded', 'true')
  ON CONFLICT (organization_id, key) DO UPDATE SET value = 'true';

  RAISE NOTICE '=========================================================';
  RAISE NOTICE 'Données DEMO générées avec succès !';
  RAISE NOTICE 'Organisation : FitManager Démo';
  RAISE NOTICE 'Types d''abonnement : %', v_sub_count;
  RAISE NOTICE 'Employés : %', v_staff_count;
  RAISE NOTICE 'Adhérents : %', v_member_count;
  RAISE NOTICE '=========================================================';
  RAISE NOTICE 'Pour réinitialiser : SELECT reset_demo_data();';
  RAISE NOTICE '=========================================================';

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ERREUR durant la génération des données DEMO : %', SQLERRM;
  RAISE NOTICE 'Rollback effectué.';
  RAISE;
END;
$$;

-- =============================================================
-- RESET FUNCTION: nettoie toutes les données DEMO
-- Organisation ciblée : slug = 'fitmanager-demo'
-- =============================================================
CREATE OR REPLACE FUNCTION reset_demo_data()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_org_id UUID;
  v_count INT;
  v_total INT := 0;
  v_member_ids UUID[];
BEGIN
  SELECT id INTO v_org_id FROM organizations WHERE slug = 'fitmanager-demo';
  IF v_org_id IS NULL THEN
    RETURN 'Aucune donnée DEMO trouvée.';
  END IF;

  -- Collect demo member IDs
  SELECT ARRAY_AGG(id) INTO v_member_ids FROM members WHERE organization_id = v_org_id AND notes LIKE '%[DEMO]%';

  -- Delete in FK-safe order (leaf tables first)
  DELETE FROM rfid_audit_log WHERE member_id = ANY(v_member_ids);
  GET DIAGNOSTICS v_count = ROW_COUNT; v_total := v_total + v_count;

  DELETE FROM rfid_read_logs WHERE member_id = ANY(v_member_ids);
  GET DIAGNOSTICS v_count = ROW_COUNT; v_total := v_total + v_count;

  DELETE FROM rfid_cards WHERE member_id = ANY(v_member_ids);
  GET DIAGNOSTICS v_count = ROW_COUNT; v_total := v_total + v_count;

  DELETE FROM attendance WHERE organization_id = v_org_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_total := v_total + v_count;

  DELETE FROM stock_movements WHERE organization_id = v_org_id AND notes LIKE '%[DEMO]%';
  GET DIAGNOSTICS v_count = ROW_COUNT; v_total := v_total + v_count;

  DELETE FROM payments WHERE organization_id = v_org_id AND notes LIKE '%[DEMO]%';
  GET DIAGNOSTICS v_count = ROW_COUNT; v_total := v_total + v_count;

  DELETE FROM member_badges WHERE member_id = ANY(v_member_ids);
  GET DIAGNOSTICS v_count = ROW_COUNT; v_total := v_total + v_count;

  DELETE FROM equipment_reservations WHERE member_id = ANY(v_member_ids);
  GET DIAGNOSTICS v_count = ROW_COUNT; v_total := v_total + v_count;

  DELETE FROM pos_transactions WHERE organization_id = v_org_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_total := v_total + v_count;

  DELETE FROM pos_sessions WHERE organization_id = v_org_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_total := v_total + v_count;

  DELETE FROM purchase_orders WHERE organization_id = v_org_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_total := v_total + v_count;

  DELETE FROM member_subscriptions WHERE organization_id = v_org_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_total := v_total + v_count;

  DELETE FROM class_enrollments WHERE class_id IN (SELECT id FROM classes WHERE organization_id = v_org_id);
  GET DIAGNOSTICS v_count = ROW_COUNT; v_total := v_total + v_count;

  DELETE FROM classes WHERE organization_id = v_org_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_total := v_total + v_count;

  DELETE FROM staff_shifts WHERE organization_id = v_org_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_total := v_total + v_count;

  DELETE FROM staff_timesheet WHERE organization_id = v_org_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_total := v_total + v_count;

  DELETE FROM staff_leaves WHERE organization_id = v_org_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_total := v_total + v_count;

  DELETE FROM staff WHERE organization_id = v_org_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_total := v_total + v_count;

  DELETE FROM members WHERE organization_id = v_org_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_total := v_total + v_count;

  DELETE FROM inventory WHERE organization_id = v_org_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_total := v_total + v_count;

  DELETE FROM products WHERE organization_id = v_org_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_total := v_total + v_count;

  DELETE FROM subscription_types WHERE organization_id = v_org_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_total := v_total + v_count;

  DELETE FROM suppliers WHERE organization_id = v_org_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_total := v_total + v_count;

  -- Reset seed flag (keep settings, just reset the flag)
  UPDATE settings SET value = 'false' WHERE organization_id = v_org_id AND key = 'demo_data_seeded';
  GET DIAGNOSTICS v_count = ROW_COUNT; v_total := v_total + v_count;

  RETURN v_total || ' lignes supprimées. Données DEMO réinitialisées. Vous pouvez relancer le script de génération.';
END;
$$;

-- =============================================================
-- GRANT EXECUTION
-- =============================================================
GRANT EXECUTE ON FUNCTION reset_demo_data() TO authenticated;
GRANT EXECUTE ON FUNCTION reset_demo_data() TO service_role;
