/**
 * philippineAddresses.ts
 *
 * Official Philippine Standard Geographic Code (PSGC) reference dataset for Mobile.
 * Region -> Province -> City / Municipality -> Barangay
 */

export interface CityData {
  name: string;
  postalCode?: string;
  barangays?: string[];
}

export interface ProvinceData {
  name: string;
  cities: CityData[];
}

export interface RegionData {
  code: string;
  name: string;
  provinces: ProvinceData[];
}

export const PHILIPPINE_REGIONS: RegionData[] = [
  // ── National Capital Region (NCR) ──────────────────────────────────────────
  {
    code: "NCR",
    name: "National Capital Region (NCR)",
    provinces: [
      {
        name: "Metro Manila",
        cities: [
          {
            name: "Quezon City",
            postalCode: "1100",
            barangays: [
              "Alicia", "Amihan", "Bagong Silangan", "Batasan Hills", "Blue Ridge", "Botocan",
              "Commonwealth", "Culiat", "Damayang Lagi", "Diliman", "Don Manuel", "Doña Imelda",
              "Fairview", "Greater Lagro", "Holy Spirit", "Kamuning", "Katipunan", "Kaunlaran",
              "Kristong Hari", "Krus na Ligas", "Loyola Heights", "Matandang Balara", "Milagrosa",
              "New Era", "North Fairview", "Novas / Novaliches", "Old Capitol Site", "Pansol",
              "Payatas", "Phil-Am", "Pinagkaisahan", "Project 6", "Roxas", "Sacred Heart",
              "San Bartolome", "San Roque", "Santa Cruz", "Santa Monica", "Sikatuna Village",
              "South Triangle", "Tandang Sora", "Teacher's Village East", "Teacher's Village West",
              "Ugong Norte", "UP Campus", "Valencia", "Veterans Village", "White Plains"
            ],
          },
          {
            name: "City of Manila",
            postalCode: "1000",
            barangays: [
              "Binondo", "Ermita", "Intramuros", "Malate", "Paco", "Pandacan",
              "Port Area", "Quiapo", "Sampaloc", "San Andres", "San Miguel",
              "San Nicolas", "Santa Ana", "Santa Cruz", "Santa Mesa", "Tondo I", "Tondo II"
            ],
          },
          {
            name: "Makati City",
            postalCode: "1200",
            barangays: [
              "Bangkal", "Bel-Air", "Carmona", "Cembo", "Comembo", "Dasmarinas", "East Rembo",
              "Forbes Park", "Guadalupe Nuevo", "Guadalupe Viejo", "Kasilawan", "La Paz",
              "Magallanes", "Olympia", "Palanan", "Pembo", "Pinagkaisahan", "Pio del Pilar",
              "Pitogo", "Poblacion", "San Antonio", "San Isidro", "San Lorenzo", "Santa Cruz",
              "Singkamas", "South Cembo", "Tejeros", "Urdaneta", "Valenzuela", "West Rembo"
            ],
          },
          {
            name: "Taguig City",
            postalCode: "1630",
            barangays: [
              "Bagumbayan", "Bambang", "Calzada", "Central Bicutan", "Central Signal Village",
              "Fort Bonifacio", "Hagonoy", "Ibayo-Tipas", "Katuparan", "Ligid-Tipas", "Lower Bicutan",
              "Maharlika Village", "Napindan", "New Lower Bicutan", "North Daang Hari",
              "Pinagsama", "San Miguel", "Santa Ana", "South Daang Hari", "South Signal Village",
              "Tuktukan", "Upper Bicutan", "Ususan", "Wawa", "Western Bicutan"
            ],
          },
          {
            name: "Pasig City",
            postalCode: "1600",
            barangays: [
              "Bagong Ilog", "Bambang", "Buting", "Caniogan", "Dela Paz", "Kalawaan",
              "Kapasigan", "Kapitolyo", "Malinao", "Manggahan", "Maybunga", "Oranbo",
              "Palatiw", "Pinagbuhatan", "Pineda", "Rosario", "Sagad", "San Antonio",
              "San Joaquin", "San Jose", "San Miguel", "San Nicolas", "Santa Cruz",
              "Santa Lucia", "Santolan", "Santo Tomas", "Sumilang", "Ugong"
            ],
          },
          {
            name: "Mandaluyong City",
            postalCode: "1550",
            barangays: [
              "Addition Hills", "Bagong Silang", "Barangka Drive", "Barangka Ilaya",
              "Barangka Itaas", "Buayang Bato", "Burol", "Daang Bakal", "Hagdang Bato",
              "Highway Hills", "Hulo", "Malamig", "Namayan", "Plainview", "Pleasant Hills", "Poblacion", "Wack-Wack"
            ],
          },
          {
            name: "San Juan City",
            postalCode: "1500",
            barangays: ["Addition Hills", "Balong-Bato", "Batis", "Corazon de Jesus", "Greenhills", "Little Baguio", "Maytunas", "Poblacion", "West Crame"],
          },
          {
            name: "Caloocan City",
            postalCode: "1400",
            barangays: ["Bagong Barrio", "Bagumbong", "Camarin", "Deparo", "Grace Park East", "Grace Park West", "Heroes del 96", "Poblacion", "Tala"],
          },
          { name: "Malabon City", postalCode: "1470", barangays: ["Baritan", "Catmon", "Concepcion", "Dampalit", "Flores", "Hulong Duhat", "Potrero", "Tonsuya"] },
          { name: "Navotas City", postalCode: "1485", barangays: ["Bagumbayan", "Bangkulasi", "Daanghari", "San Jose", "San Roque", "Tangos", "Tanza"] },
          { name: "Valenzuela City", postalCode: "1440", barangays: ["Arkong Bato", "Bagbaguin", "Bignay", "Canumay", "Dalandanan", "Gen. T. de Leon", "Karuhatan", "Malanday", "Malinta", "Marulas"] },
          { name: "Marikina City", postalCode: "1800", barangays: ["Barangka", "Calumpang", "Concepcion", "Fortune", "Industrial Valley", "Marikina Heights", "Nangka", "Parang", "San Roque", "Santo Niño"] },
          { name: "Parañaque City", postalCode: "1700", barangays: ["Baclaran", "BF Homes", "Don Bosco", "Don Galo", "La Huerta", "Moonwalk", "San Antonio", "San Dionisio", "San Isidro", "Sun Valley", "Tambo"] },
          { name: "Pasay City", postalCode: "1300", barangays: ["Poblacion (Barangay 1-20)", "Mall of Asia Complex (Barangay 76)", "Villamor Airbase (Barangay 183)", "San Jose", "Santa Clara"] },
          { name: "Las Piñas City", postalCode: "1740", barangays: ["Almanza", "BF International", "Daniel Fajardo", "Manuyo", "Pamplona", "Pilar", "Pulang Lupa", "Talon", "Zapote"] },
          { name: "Muntinlupa City", postalCode: "1770", barangays: ["Alabang", "Bayanan", "Buli", "Cupang", "Poblacion", "Putatan", "Sucat", "Tunasan"] },
          { name: "Pateros", postalCode: "1620", barangays: ["Aguho", "Magtanggol", "Martirez", "Poblacion", "San Pedro", "San Roque", "Santa Ana"] },
        ],
      },
    ],
  },

  // ── Cordillera Administrative Region (CAR) ─────────────────────────────────
  {
    code: "CAR",
    name: "Cordillera Administrative Region (CAR)",
    provinces: [
      {
        name: "Benguet",
        cities: [
          {
            name: "Baguio City",
            postalCode: "2600",
            barangays: [
              "Asin Road", "Aurora Hill", "Bakakeng Central", "Camp 7", "Engineers' Hill",
              "Gibraltar", "Irisan", "Kias", "Loakan", "Mines View Park", "Pacdal",
              "Pinsao Proper", "Quirino Hill", "San Luis", "Scout Barrio", "Session Road", "Trancoville"
            ],
          },
          { name: "La Trinidad", postalCode: "2601", barangays: ["Balili", "Betag", "Poblacion", "Puguis", "Wangal"] },
          { name: "Itogon", postalCode: "2604" },
          { name: "Tuba", postalCode: "2603" },
          { name: "Tublay", postalCode: "2615" },
        ],
      },
      {
        name: "Abra",
        cities: [
          { name: "Bangued (Capital)", postalCode: "2800" },
          { name: "Bucay", postalCode: "2805" },
          { name: "Dolores", postalCode: "2801" },
        ],
      },
      {
        name: "Apayao",
        cities: [
          { name: "Kabugao (Capital)", postalCode: "3809" },
          { name: "Conner", postalCode: "3807" },
          { name: "Luna", postalCode: "3813" },
        ],
      },
      {
        name: "Ifugao",
        cities: [
          { name: "Lagawe (Capital)", postalCode: "3600" },
          { name: "Banaue", postalCode: "3601" },
          { name: "Kiangan", postalCode: "3604" },
        ],
      },
      {
        name: "Kalinga",
        cities: [
          { name: "Tabuk City (Capital)", postalCode: "3800" },
          { name: "Lubuagan", postalCode: "3802" },
          { name: "Pinukpuk", postalCode: "3804" },
        ],
      },
      {
        name: "Mountain Province",
        cities: [
          { name: "Bontoc (Capital)", postalCode: "2616" },
          { name: "Sagada", postalCode: "2619" },
          { name: "Bauko", postalCode: "2621" },
        ],
      },
    ],
  },

  // ── Region I (Ilocos Region) ────────────────────────────────────────────────
  {
    code: "Region I",
    name: "Region I – Ilocos Region",
    provinces: [
      {
        name: "Ilocos Norte",
        cities: [
          { name: "Laoag City (Capital)", postalCode: "2900" },
          { name: "Batac City", postalCode: "2906" },
          { name: "Pagudpud", postalCode: "2919" },
          { name: "Paoay", postalCode: "2902" },
          { name: "San Nicolas", postalCode: "2901" },
        ],
      },
      {
        name: "Ilocos Sur",
        cities: [
          { name: "Vigan City (Capital)", postalCode: "2700" },
          { name: "Candon City", postalCode: "2710" },
          { name: "Narvacan", postalCode: "2704" },
          { name: "Tagudin", postalCode: "2714" },
        ],
      },
      {
        name: "La Union",
        cities: [
          { name: "San Fernando City (Capital)", postalCode: "2500" },
          { name: "San Juan (Surfing Capital)", postalCode: "2514" },
          { name: "Agoo", postalCode: "2504" },
          { name: "Bauang", postalCode: "2501" },
        ],
      },
      {
        name: "Pangasinan",
        cities: [
          { name: "Dagupan City", postalCode: "2400" },
          { name: "San Carlos City", postalCode: "2420" },
          { name: "Urdaneta City", postalCode: "2428" },
          { name: "Alaminos City (Hundred Islands)", postalCode: "2404" },
          { name: "Lingayen (Capital)", postalCode: "2401" },
          { name: "Rosales", postalCode: "2441" },
        ],
      },
    ],
  },

  // ── Region II (Cagayan Valley) ──────────────────────────────────────────────
  {
    code: "Region II",
    name: "Region II – Cagayan Valley",
    provinces: [
      {
        name: "Cagayan",
        cities: [
          { name: "Tuguegarao City (Capital)", postalCode: "3500" },
          { name: "Aparri", postalCode: "3515" },
          { name: "Lal-lo", postalCode: "3509" },
        ],
      },
      {
        name: "Isabela",
        cities: [
          { name: "Ilagan City (Capital)", postalCode: "3300" },
          { name: "Santiago City", postalCode: "3311" },
          { name: "Cauayan City", postalCode: "3305" },
          { name: "Roxas", postalCode: "3320" },
        ],
      },
      {
        name: "Nueva Vizcaya",
        cities: [
          { name: "Bayombong (Capital)", postalCode: "3700" },
          { name: "Solano", postalCode: "3709" },
          { name: "Bambang", postalCode: "3702" },
        ],
      },
      {
        name: "Quirino",
        cities: [
          { name: "Cabarroguis (Capital)", postalCode: "3400" },
          { name: "Diffun", postalCode: "3401" },
          { name: "Maddela", postalCode: "3404" },
        ],
      },
      {
        name: "Batanes",
        cities: [
          { name: "Basco (Capital)", postalCode: "3900" },
          { name: "Ivana", postalCode: "3902" },
          { name: "Sabtang", postalCode: "3904" },
        ],
      },
    ],
  },

  // ── Region III (Central Luzon) ──────────────────────────────────────────────
  {
    code: "Region III",
    name: "Region III – Central Luzon",
    provinces: [
      {
        name: "Pampanga",
        cities: [
          { name: "San Fernando City (Capital)", postalCode: "2000" },
          { name: "Angeles City", postalCode: "2009" },
          { name: "Mabalacat City (Clark)", postalCode: "2010" },
          { name: "Guagua", postalCode: "2003" },
          { name: "Lubao", postalCode: "2005" },
          { name: "Mexico", postalCode: "2021" },
        ],
      },
      {
        name: "Bulacan",
        cities: [
          { name: "Malolos City (Capital)", postalCode: "3000" },
          { name: "San Jose del Monte City", postalCode: "3023" },
          { name: "Meycauayan City", postalCode: "3020" },
          { name: "Baliuag City", postalCode: "3006" },
          { name: "Marilao", postalCode: "3019" },
          { name: "Santa Maria", postalCode: "3022" },
        ],
      },
      {
        name: "Bataan",
        cities: [
          { name: "Balanga City (Capital)", postalCode: "2100" },
          { name: "Dinalupihan", postalCode: "2110" },
          { name: "Mariveles", postalCode: "2105" },
          { name: "Hermosa", postalCode: "2111" },
        ],
      },
      {
        name: "Nueva Ecija",
        cities: [
          { name: "Palayan City (Capital)", postalCode: "3132" },
          { name: "Cabanatuan City", postalCode: "3100" },
          { name: "Gapan City", postalCode: "3105" },
          { name: "San Jose City", postalCode: "3121" },
          { name: "Muñoz Science City", postalCode: "3119" },
        ],
      },
      {
        name: "Tarlac",
        cities: [
          { name: "Tarlac City (Capital)", postalCode: "2300" },
          { name: "Capas", postalCode: "2315" },
          { name: "Concepcion", postalCode: "2316" },
          { name: "Paniqui", postalCode: "2307" },
        ],
      },
      {
        name: "Zambales",
        cities: [
          { name: "Olongapo City", postalCode: "2200" },
          { name: "Iba (Capital)", postalCode: "2201" },
          { name: "Subic", postalCode: "2209" },
        ],
      },
      {
        name: "Aurora",
        cities: [
          { name: "Baler (Capital)", postalCode: "3200" },
          { name: "Casiguran", postalCode: "3204" },
          { name: "Dipaculao", postalCode: "3203" },
        ],
      },
    ],
  },

  // ── Region IV-A (CALABARZON) ────────────────────────────────────────────────
  {
    code: "Region IV-A",
    name: "Region IV-A – CALABARZON",
    provinces: [
      {
        name: "Cavite",
        cities: [
          { name: "Bacoor City", postalCode: "4102" },
          { name: "Imus City (Capital)", postalCode: "4103" },
          { name: "Dasmariñas City", postalCode: "4114" },
          { name: "General Trias City", postalCode: "4107" },
          { name: "Tagaytay City", postalCode: "4120" },
          { name: "Trece Martires City", postalCode: "4109" },
          { name: "Cavite City", postalCode: "4100" },
          { name: "Carmona City", postalCode: "4116" },
          { name: "Silang", postalCode: "4118" },
          { name: "Tanza", postalCode: "4108" },
          { name: "Kawit", postalCode: "4104" },
        ],
      },
      {
        name: "Laguna",
        cities: [
          { name: "Calamba City", postalCode: "4027" },
          { name: "Santa Rosa City", postalCode: "4026" },
          { name: "Biñan City", postalCode: "4024" },
          { name: "San Pedro City", postalCode: "4023" },
          { name: "Cabuyao City", postalCode: "4025" },
          { name: "San Pablo City", postalCode: "4000" },
          { name: "Santa Cruz (Capital)", postalCode: "4009" },
          { name: "Los Baños", postalCode: "4030" },
          { name: "Pagsanjan", postalCode: "4011" },
        ],
      },
      {
        name: "Batangas",
        cities: [
          { name: "Batangas City (Capital)", postalCode: "4200" },
          { name: "Lipa City", postalCode: "4217" },
          { name: "Tanauan City", postalCode: "4232" },
          { name: "Santo Tomas City", postalCode: "4234" },
          { name: "Nasugbu", postalCode: "4231" },
          { name: "Bauan", postalCode: "4201" },
          { name: "Lemery", postalCode: "4209" },
        ],
      },
      {
        name: "Rizal",
        cities: [
          { name: "Antipolo City (Capital)", postalCode: "1870" },
          { name: "Cainta", postalCode: "1900" },
          { name: "Taytay", postalCode: "1920" },
          { name: "San Mateo", postalCode: "1850" },
          { name: "Rodriguez (Montalban)", postalCode: "1860" },
          { name: "Binangonan", postalCode: "1940" },
          { name: "Angono", postalCode: "1930" },
        ],
      },
      {
        name: "Quezon",
        cities: [
          { name: "Lucena City (Capital)", postalCode: "4301" },
          { name: "Tayabas City", postalCode: "4327" },
          { name: "Candelaria", postalCode: "4323" },
          { name: "Sariaya", postalCode: "4322" },
          { name: "Lucban", postalCode: "4328" },
        ],
      },
    ],
  },

  // ── MIMAROPA Region ─────────────────────────────────────────────────────────
  {
    code: "MIMAROPA",
    name: "MIMAROPA Region",
    provinces: [
      {
        name: "Palawan",
        cities: [
          { name: "Puerto Princesa City (Capital)", postalCode: "5300" },
          { name: "Coron", postalCode: "5316" },
          { name: "El Nido", postalCode: "5313" },
          { name: "San Vicente", postalCode: "5309" },
        ],
      },
      {
        name: "Oriental Mindoro",
        cities: [
          { name: "Calapan City (Capital)", postalCode: "5200" },
          { name: "Puerto Galera", postalCode: "5203" },
          { name: "Naujan", postalCode: "5204" },
        ],
      },
      {
        name: "Occidental Mindoro",
        cities: [
          { name: "Mamburao (Capital)", postalCode: "5106" },
          { name: "San Jose", postalCode: "5100" },
        ],
      },
      {
        name: "Marinduque",
        cities: [
          { name: "Boac (Capital)", postalCode: "4900" },
          { name: "Santa Cruz", postalCode: "4902" },
        ],
      },
      {
        name: "Romblon",
        cities: [
          { name: "Romblon (Capital)", postalCode: "5500" },
          { name: "Odiongan", postalCode: "5505" },
        ],
      },
    ],
  },

  // ── Region V (Bicol Region) ─────────────────────────────────────────────────
  {
    code: "Region V",
    name: "Region V – Bicol Region",
    provinces: [
      {
        name: "Albay",
        cities: [
          { name: "Legazpi City (Capital)", postalCode: "4500" },
          { name: "Ligao City", postalCode: "4504" },
          { name: "Tabaco City", postalCode: "4511" },
          { name: "Daraga", postalCode: "4501" },
        ],
      },
      {
        name: "Camarines Sur",
        cities: [
          { name: "Naga City", postalCode: "4400" },
          { name: "Pili (Capital)", postalCode: "4418" },
          { name: "Iriga City", postalCode: "4431" },
          { name: "Libmanan", postalCode: "4407" },
        ],
      },
      {
        name: "Camarines Norte",
        cities: [
          { name: "Daet (Capital)", postalCode: "4600" },
          { name: "Labo", postalCode: "4604" },
        ],
      },
      {
        name: "Sorsogon",
        cities: [
          { name: "Sorsogon City (Capital)", postalCode: "4700" },
          { name: "Bulan", postalCode: "4706" },
        ],
      },
      {
        name: "Catanduanes",
        cities: [
          { name: "Virac (Capital)", postalCode: "4800" },
          { name: "San Andres", postalCode: "4810" },
        ],
      },
      {
        name: "Masbate",
        cities: [
          { name: "Masbate City (Capital)", postalCode: "5400" },
          { name: "Aroroy", postalCode: "5414" },
        ],
      },
    ],
  },

  // ── Region VI (Western Visayas) ─────────────────────────────────────────────
  {
    code: "Region VI",
    name: "Region VI – Western Visayas",
    provinces: [
      {
        name: "Iloilo",
        cities: [
          {
            name: "Iloilo City",
            postalCode: "5000",
            barangays: ["Arevalo", "City Proper", "Jaro", "La Paz", "Lapuz", "Mandurriao", "Molo", "San Rafael", "Tabuc Suba"],
          },
          { name: "Passi City", postalCode: "5037" },
          { name: "Oton", postalCode: "5020" },
          { name: "Pavia", postalCode: "5001" },
          { name: "Santa Barbara", postalCode: "5002" },
        ],
      },
      {
        name: "Negros Occidental",
        cities: [
          {
            name: "Bacolod City (Capital)",
            postalCode: "6100",
            barangays: ["Alijis", "Bata", "Estefania", "Mandalagan", "Mansilingan", "Singcang-Airport", "Sum-ag", "Taculing", "Tangub", "Villamonte"],
          },
          { name: "Bago City", postalCode: "6101" },
          { name: "Silay City", postalCode: "6116" },
          { name: "Talisay City", postalCode: "6115" },
          { name: "Kabankalan City", postalCode: "6111" },
        ],
      },
      {
        name: "Capiz",
        cities: [
          { name: "Roxas City (Capital)", postalCode: "5800" },
          { name: "Panay", postalCode: "5801" },
        ],
      },
      {
        name: "Aklan",
        cities: [
          { name: "Kalibo (Capital)", postalCode: "5600" },
          { name: "Malay (Boracay)", postalCode: "5608" },
        ],
      },
      {
        name: "Antique",
        cities: [
          { name: "San Jose de Buenavista (Capital)", postalCode: "5700" },
          { name: "Sibalom", postalCode: "5701" },
        ],
      },
      {
        name: "Guimaras",
        cities: [
          { name: "Jordan (Capital)", postalCode: "5045" },
          { name: "Buenavista", postalCode: "5044" },
        ],
      },
    ],
  },

  // ── Region VII (Central Visayas) ────────────────────────────────────────────
  {
    code: "Region VII",
    name: "Region VII – Central Visayas",
    provinces: [
      {
        name: "Cebu",
        cities: [
          {
            name: "Cebu City",
            postalCode: "6000",
            barangays: [
              "Apas (IT Park)", "Banilad", "Basak San Nicolas", "Buhisan", "Camputhaw",
              "Capitol Site", "Guadalupe", "Kasambagan", "Labangon", "Lahug", "Mabolo",
              "Mambaling", "Pasil", "Punta Princesa", "Sambag I", "Sambag II", "San Nicolas",
              "Santo Niño", "Talamban", "Tejero", "Tisa", "Zapatera"
            ],
          },
          {
            name: "Mandaue City",
            postalCode: "6014",
            barangays: ["Bakilid", "Banilad", "Basak", "Cabancalan", "Centro (Poblacion)", "Guizo", "Maguikay", "Subangdaku", "Tipolo"],
          },
          {
            name: "Lapu-Lapu City (Opon)",
            postalCode: "6015",
            barangays: ["Agus", "Bankal", "Basak", "Gun-ob", "Ibo (MEPZ)", "Mactan", "Maribago", "Pajac", "Poblacion", "Pusok"],
          },
          { name: "Talisay City", postalCode: "6045" },
          { name: "Toledo City", postalCode: "6038" },
          { name: "Danao City", postalCode: "6004" },
          { name: "City of Naga", postalCode: "6037" },
          { name: "Carcar City", postalCode: "6019" },
          { name: "Bogo City", postalCode: "6018" },
          { name: "Minglanilla", postalCode: "6046" },
          { name: "Consolacion", postalCode: "6001" },
          { name: "Liloan", postalCode: "6002" },
        ],
      },
      {
        name: "Bohol",
        cities: [
          { name: "Tagbilaran City (Capital)", postalCode: "6300" },
          { name: "Panglao", postalCode: "6340" },
          { name: "Dauis", postalCode: "6339" },
          { name: "Tubigon", postalCode: "6329" },
        ],
      },
      {
        name: "Negros Oriental",
        cities: [
          { name: "Dumaguete City (Capital)", postalCode: "6200" },
          { name: "Bais City", postalCode: "6206" },
          { name: "Bayawan City", postalCode: "6221" },
          { name: "Sibulan", postalCode: "6201" },
        ],
      },
      {
        name: "Siquijor",
        cities: [
          { name: "Siquijor (Capital)", postalCode: "6225" },
          { name: "Larena", postalCode: "6226" },
          { name: "San Juan", postalCode: "6227" },
        ],
      },
    ],
  },

  // ── Region VIII (Eastern Visayas) ───────────────────────────────────────────
  {
    code: "Region VIII",
    name: "Region VIII – Eastern Visayas",
    provinces: [
      {
        name: "Leyte",
        cities: [
          { name: "Tacloban City (Capital)", postalCode: "6500" },
          { name: "Ormoc City", postalCode: "6541" },
          { name: "Baybay City", postalCode: "6521" },
          { name: "Palo", postalCode: "6501" },
        ],
      },
      {
        name: "Southern Leyte",
        cities: [
          { name: "Maasin City (Capital)", postalCode: "6600" },
          { name: "Sogod", postalCode: "6606" },
        ],
      },
      {
        name: "Samar (Western Samar)",
        cities: [
          { name: "Catbalogan City (Capital)", postalCode: "6700" },
          { name: "Calbayog City", postalCode: "6710" },
        ],
      },
      {
        name: "Eastern Samar",
        cities: [
          { name: "Borongan City (Capital)", postalCode: "6800" },
          { name: "Guiuan", postalCode: "6809" },
        ],
      },
      {
        name: "Northern Samar",
        cities: [
          { name: "Catarman (Capital)", postalCode: "6400" },
          { name: "Laoang", postalCode: "6411" },
        ],
      },
      {
        name: "Biliran",
        cities: [
          { name: "Naval (Capital)", postalCode: "6560" },
          { name: "Biliran", postalCode: "6566" },
        ],
      },
    ],
  },

  // ── Region IX (Zamboanga Peninsula) ─────────────────────────────────────────
  {
    code: "Region IX",
    name: "Region IX – Zamboanga Peninsula",
    provinces: [
      {
        name: "Zamboanga del Sur",
        cities: [
          {
            name: "Zamboanga City (Independent)",
            postalCode: "7000",
            barangays: ["Ayala", "Baliwasan", "Calarian", "Guiwan", "Pasonanca", "Putik", "Santa Maria", "Tetuan", "Tumaga"],
          },
          { name: "Pagadian City (Capital)", postalCode: "7016" },
          { name: "Aurora", postalCode: "7020" },
        ],
      },
      {
        name: "Zamboanga del Norte",
        cities: [
          { name: "Dipolog City (Capital)", postalCode: "7100" },
          { name: "Dapitan City", postalCode: "7101" },
        ],
      },
      {
        name: "Zamboanga Sibugay",
        cities: [
          { name: "Ipil (Capital)", postalCode: "7001" },
          { name: "Kabasalan", postalCode: "7005" },
        ],
      },
    ],
  },

  // ── Region X (Northern Mindanao) ────────────────────────────────────────────
  {
    code: "Region X",
    name: "Region X – Northern Mindanao",
    provinces: [
      {
        name: "Misamis Oriental",
        cities: [
          {
            name: "Cagayan de Oro City (Capital)",
            postalCode: "9000",
            barangays: ["Balulang", "Bulua", "Camaman-an", "Carmen", "Gusa", "Iponan", "Kauswagan", "Lapasan", "Macasandig", "Nazareth", "Patag", "Puerto"],
          },
          { name: "Gingoog City", postalCode: "9014" },
          { name: "El Salvador City", postalCode: "9017" },
          { name: "Tagoloan", postalCode: "9001" },
        ],
      },
      {
        name: "Bukidnon",
        cities: [
          { name: "Malaybalay City (Capital)", postalCode: "8700" },
          { name: "Valencia City", postalCode: "8709" },
          { name: "Manolo Fortich", postalCode: "8703" },
        ],
      },
      {
        name: "Lanao del Norte",
        cities: [
          { name: "Iligan City", postalCode: "9200" },
          { name: "Tubod (Capital)", postalCode: "9209" },
        ],
      },
      {
        name: "Misamis Occidental",
        cities: [
          { name: "Oroquieta City (Capital)", postalCode: "7207" },
          { name: "Ozamiz City", postalCode: "7200" },
        ],
      },
      {
        name: "Camiguin",
        cities: [{ name: "Mambajao (Capital)", postalCode: "9100" }],
      },
    ],
  },

  // ── Region XI (Davao Region) ────────────────────────────────────────────────
  {
    code: "Region XI",
    name: "Region XI – Davao Region",
    provinces: [
      {
        name: "Davao del Sur",
        cities: [
          {
            name: "Davao City",
            postalCode: "8000",
            barangays: [
              "Agdao", "Bajada", "Bucana (76-A)", "Buhangin", "Bunawan", "Cabantian",
              "Calinan", "Catalunan Grande", "Catalunan Pequeño", "Lanang", "Ma-a",
              "Matina Aplaya", "Matina Crossing", "Mintal", "Panacan", "Poblacion (Barangay 1-40)",
              "Sasa", "Talomo Proper", "Toril Proper", "Tugbok"
            ],
          },
          { name: "Digos City (Capital)", postalCode: "8002" },
          { name: "Santa Cruz", postalCode: "8001" },
          { name: "Bansalan", postalCode: "8005" },
        ],
      },
      {
        name: "Davao del Norte",
        cities: [
          { name: "Tagum City (Capital)", postalCode: "8100" },
          { name: "Panabo City", postalCode: "8105" },
          { name: "Island Garden City of Samal", postalCode: "8119" },
        ],
      },
      {
        name: "Davao de Oro",
        cities: [
          { name: "Nabunturan (Capital)", postalCode: "8800" },
          { name: "Monkayo", postalCode: "8805" },
        ],
      },
      {
        name: "Davao Oriental",
        cities: [
          { name: "Mati City (Capital)", postalCode: "8200" },
          { name: "Lupon", postalCode: "8207" },
        ],
      },
      {
        name: "Davao Occidental",
        cities: [{ name: "Malita (Capital)", postalCode: "8012" }],
      },
    ],
  },

  // ── Region XII (SOCCSKSARGEN) ───────────────────────────────────────────────
  {
    code: "Region XII",
    name: "Region XII – SOCCSKSARGEN",
    provinces: [
      {
        name: "South Cotabato",
        cities: [
          {
            name: "General Santos City",
            postalCode: "9500",
            barangays: ["Apopong", "Bula", "Calumpang", "City Heights", "Dadiangas", "Fatima", "Lagao", "Labangal", "Mabuhay", "San Isidro", "Tambler"],
          },
          { name: "Koronadal City (Capital)", postalCode: "9506" },
          { name: "Polomolok", postalCode: "9504" },
          { name: "Tupi", postalCode: "9505" },
        ],
      },
      {
        name: "Cotabato (North Cotabato)",
        cities: [
          { name: "Kidapawan City (Capital)", postalCode: "9400" },
          { name: "Midsayap", postalCode: "9410" },
        ],
      },
      {
        name: "Sultan Kudarat",
        cities: [
          { name: "Tacurong City", postalCode: "9800" },
          { name: "Isulan (Capital)", postalCode: "9805" },
        ],
      },
      {
        name: "Sarangani",
        cities: [
          { name: "Alabel (Capital)", postalCode: "9501" },
          { name: "Glan", postalCode: "9517" },
        ],
      },
    ],
  },

  // ── Region XIII (Caraga) ────────────────────────────────────────────────────
  {
    code: "Region XIII",
    name: "Region XIII – Caraga",
    provinces: [
      {
        name: "Agusan del Norte",
        cities: [
          { name: "Butuan City (Capital)", postalCode: "8600" },
          { name: "Cabadbaran City", postalCode: "8605" },
        ],
      },
      {
        name: "Agusan del Sur",
        cities: [
          { name: "Bayugan City", postalCode: "8502" },
          { name: "Prosperidad (Capital)", postalCode: "8500" },
        ],
      },
      {
        name: "Surigao del Norte",
        cities: [
          { name: "Surigao City (Capital)", postalCode: "8400" },
          { name: "General Luna (Siargao)", postalCode: "8419" },
        ],
      },
      {
        name: "Surigao del Sur",
        cities: [
          { name: "Tandag City (Capital)", postalCode: "8300" },
          { name: "Bislig City", postalCode: "8311" },
        ],
      },
      {
        name: "Dinagat Islands",
        cities: [{ name: "San Jose (Capital)", postalCode: "8427" }],
      },
    ],
  },

  // ── Bangsamoro Autonomous Region in Muslim Mindanao (BARMM) ────────────────
  {
    code: "BARMM",
    name: "BARMM – Bangsamoro Autonomous Region",
    provinces: [
      {
        name: "Maguindanao del Norte",
        cities: [
          { name: "Cotabato City (Regional Center)", postalCode: "9600" },
          { name: "Datu Odin Sinsuat (Capital)", postalCode: "9601" },
        ],
      },
      {
        name: "Maguindanao del Sur",
        cities: [{ name: "Buluan (Capital)", postalCode: "9616" }],
      },
      {
        name: "Lanao del Sur",
        cities: [
          { name: "Marawi City (Capital)", postalCode: "9700" },
          { name: "Wao", postalCode: "9716" },
        ],
      },
      {
        name: "Basilan",
        cities: [{ name: "Isabela City", postalCode: "7300" }],
      },
      {
        name: "Sulu",
        cities: [{ name: "Jolo (Capital)", postalCode: "7400" }],
      },
      {
        name: "Tawi-Tawi",
        cities: [{ name: "Bongao (Capital)", postalCode: "7500" }],
      },
    ],
  },
];

export function getPhilippineRegions(): RegionData[] {
  return PHILIPPINE_REGIONS;
}

export function findRegion(regionNameOrCode: string): RegionData | undefined {
  if (!regionNameOrCode) return undefined;
  const q = regionNameOrCode.trim().toLowerCase();

  // 1. Exact match on code (e.g. "Region XI", "NCR")
  const byCode = PHILIPPINE_REGIONS.find((r) => r.code.toLowerCase() === q);
  if (byCode) return byCode;

  // 2. Exact match on full name (e.g. "Region XI - Davao Region" or "Region XI – Davao Region")
  const normalizedQ = q.replace(/[–—]/g, "-");
  const byName = PHILIPPINE_REGIONS.find(
    (r) =>
      r.name.toLowerCase() === q ||
      r.name.toLowerCase().replace(/[–—]/g, "-") === normalizedQ
  );
  if (byName) return byName;

  // 3. Name contains query (e.g. user typed "davao")
  const byNameContains = PHILIPPINE_REGIONS.find((r) => r.name.toLowerCase().includes(q));
  if (byNameContains) return byNameContains;

  // 4. Roman numeral / number aliases (e.g. "region 11" -> "region xi")
  const aliasMap: Record<string, string> = {
    "region 1": "region i",
    "region 2": "region ii",
    "region 3": "region iii",
    "region 4a": "region iv-a",
    "region 4-a": "region iv-a",
    "region 4b": "mimaropa",
    "region 4-b": "mimaropa",
    "region 5": "region v",
    "region 6": "region vi",
    "region 7": "region vii",
    "region 8": "region viii",
    "region 9": "region ix",
    "region 10": "region x",
    "region 11": "region xi",
    "region 12": "region xii",
    "region 13": "region xiii",
  };
  const targetCode = aliasMap[q];
  if (targetCode) {
    const byAlias = PHILIPPINE_REGIONS.find((r) => r.code.toLowerCase() === targetCode);
    if (byAlias) return byAlias;
  }

  return undefined;
}

export function getProvincesForRegion(regionNameOrCode: string): ProvinceData[] {
  const reg = findRegion(regionNameOrCode);
  return reg ? reg.provinces : [];
}

export function findProvince(regionNameOrCode: string, provinceName: string): ProvinceData | undefined {
  const provinces = getProvincesForRegion(regionNameOrCode);
  if (!provinceName) return undefined;
  const q = provinceName.trim().toLowerCase();
  const exact = provinces.find((p) => p.name.toLowerCase() === q);
  if (exact) return exact;
  return provinces.find((p) => p.name.toLowerCase().includes(q));
}

export function getCitiesForProvince(regionNameOrCode: string, provinceName: string): CityData[] {
  const prov = findProvince(regionNameOrCode, provinceName);
  return prov ? prov.cities : [];
}

export function findCity(regionNameOrCode: string, provinceName: string, cityName: string): CityData | undefined {
  const cities = getCitiesForProvince(regionNameOrCode, provinceName);
  if (!cityName) return undefined;
  const q = cityName.trim().toLowerCase();
  const exact = cities.find((c) => c.name.toLowerCase() === q);
  if (exact) return exact;
  return cities.find((c) => c.name.toLowerCase().includes(q));
}
