/**
 * philippineAddresses.ts
 *
 * Official Philippine Standard Geographic Code (PSGC) reference dataset.
 * Provides hierarchical cascading options:
 * Region -> Province -> City / Municipality -> Barangay
 * Includes automatic postal code mappings for smooth form filling.
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
              "Pitogo", "Poblacion", "Post Proper Northside", "Post Proper Southside",
              "San Antonio", "San Isidro", "San Lorenzo", "Santa Cruz", "Singkamas",
              "South Cembo", "Tejeros", "Urdaneta", "Valenzuela", "West Rembo"
            ],
          },
          {
            name: "Taguig City",
            postalCode: "1630",
            barangays: [
              "Bagumbayan", "Bambang", "Calzada", "Central Bicutan", "Central Signal Village",
              "Fort Bonifacio", "Hagonoy", "Ibayo-Tipas", "Katuparan", "Ligid-Tipas", "Lower Bicutan",
              "Maharlika Village", "Napindan", "New Lower Bicutan", "North Daang Hari",
              "North Signal Village", "Palingon", "Pinagsama", "San Miguel", "Santa Ana",
              "South Daang Hari", "South Signal Village", "Tanyag", "Tuktukan", "Upper Bicutan",
              "Ususan", "Wawa", "Western Bicutan"
            ],
          },
          {
            name: "Pasig City",
            postalCode: "1600",
            barangays: [
              "Bagong Ilog", "Bagong Katipunan", "Bambang", "Buting", "Caniogan", "Dela Paz",
              "Kalawaan", "Kapasigan", "Kapitolyo", "Malinao", "Manggahan", "Maybunga",
              "Oranbo", "Palatiw", "Pinagbuhatan", "Pineda", "Rosario", "Sagad", "San Antonio",
              "San Joaquin", "San Jose", "San Miguel", "San Nicolas", "Santa Cruz", "Santa Lucia",
              "Santa Rosa", "Santolan", "Santo Tomas", "Sumilang", "Ugong"
            ],
          },
          {
            name: "Mandaluyong City",
            postalCode: "1550",
            barangays: [
              "Addition Hills", "Bagong Silang", "Barangka Drive", "Barangka Ilaya",
              "Barangka Itaas", "Barangka Ibaba", "Buayang Bato", "Burol", "Daang Bakal",
              "Hagdang Bato Itaas", "Hagdang Bato Libis", "Harapin Ang Bukas", "Highway Hills",
              "Hulo", "Mabini-J. Rizal", "Malamig", "Namayan", "New Zañiga", "Old Zañiga",
              "Pag-Asa", "Plainview", "Pleasant Hills", "Poblacion", "San Jose", "Vergara", "Wack-Wack Greenhills"
            ],
          },
          {
            name: "San Juan City",
            postalCode: "1500",
            barangays: [
              "Addition Hills", "Balong-Bato", "Batis", "Corazon de Jesus", "Ermitaño",
              "Greenhills", "Isabelita", "Kabayanan", "Little Baguio", "Maytunas",
              "Onse", "Pasadeña", "Pedro Cruz", "Progreso", "Rivera", "Salapan",
              "San Perfecto", "Santa Lucia", "Tibagan", "West Crame"
            ],
          },
          {
            name: "Caloocan City",
            postalCode: "1400",
            barangays: [
              "Bagong Barrio", "Bagumbong", "Camarin", "Deparo", "Grace Park East",
              "Grace Park West", "Heroes del 96", "Kaunlaran Village", "Maypajo",
              "Morning Breeze", "Poblacion", "Sangandaan", "Tala", "University Hills"
            ],
          },
          {
            name: "Malabon City",
            postalCode: "1470",
            barangays: [
              "Baritan", "Baybayin", "Catmon", "Concepcion", "Dampalit", "Flores",
              "Hulong Duhat", "Ibaba", "Longos", "Maysilo", "Muzon", "Niugan",
              "Panghulo", "Potrero", "San Agustin", "Santolan", "Tañong", "Tinajeros", "Tonsuya", "Tugatog"
            ],
          },
          {
            name: "Navotas City",
            postalCode: "1485",
            barangays: [
              "Bagumbayan North", "Bagumbayan South", "Bangkulasi", "Daanghari", "Navotas East",
              "Navotas West", "North Bay Blvd North", "North Bay Blvd South", "San Jose",
              "San Rafael Village", "San Roque", "Sipac-Almacen", "Tangos North", "Tangos South", "Tanza 1", "Tanza 2"
            ],
          },
          {
            name: "Valenzuela City",
            postalCode: "1440",
            barangays: [
              "Arkong Bato", "Bagbaguin", "Bignay", "Canumay East", "Canumay West", "Coloong",
              "Dalandanan", "Gen. T. de Leon", "Karuhatan", "Lawang Bato", "Lingunan",
              "Malanday", "Malinta", "Mapulang Lupa", "Marulas", "Maysan", "Palasan",
              "Parada", "Pariancillo Villa", "Paso de Blas", "Pasolo", "Poblacion",
              "Punturin", "Rincon", "Tagalag", "Ugong", "Viente Reales", "Wawang Pulo"
            ],
          },
          {
            name: "Marikina City",
            postalCode: "1800",
            barangays: [
              "Barangka", "Calumpang", "Concepcion Uno", "Concepcion Dos", "Fortune",
              "Industrial Valley", "Jesus Dela Peña", "Malanday", "Marikina Heights",
              "Nangka", "Parang", "San Roque", "Santa Elena", "Santo Niño", "Tañong", "Tumana"
            ],
          },
          {
            name: "Parañaque City",
            postalCode: "1700",
            barangays: [
              "Baclaran", "BF Homes", "Don Bosco", "Don Galo", "La Huerta", "Marcelo Green",
              "Merville", "Moonwalk", "San Antonio", "San Dionisio", "San Isidro",
              "San Martin de Porres", "Santo Niño", "Sun Valley", "Tambo", "Vitalez"
            ],
          },
          {
            name: "Pasay City",
            postalCode: "1300",
            barangays: [
              "Barangay 1 - 20 (Poblacion)", "Barangay 76 (Mall of Asia Complex)",
              "Barangay 183 (Villamor Airbase)", "San Jose", "San Rafael", "San Roque", "Santa Clara"
            ],
          },
          {
            name: "Las Piñas City",
            postalCode: "1740",
            barangays: [
              "Almanza Uno", "Almanza Dos", "BF International", "Daniel Fajardo", "Elias Aldana",
              "Ilaya", "Manuyo Uno", "Manuyo Dos", "Pamplona Uno", "Pamplona Dos", "Pamplona Tres",
              "Pilar", "Pulang Lupa Uno", "Pulang Lupa Dos", "Talon Uno", "Talon Dos", "Talon Tres",
              "Talon Cuatro", "Talon Singko", "Zapote"
            ],
          },
          {
            name: "Muntinlupa City",
            postalCode: "1770",
            barangays: [
              "Alabang", "Bayanan", "Buli", "Cupang", "Poblacion",
              "Putatan", "Sucat", "Tunasan", "New Bilibid Prison Reservation"
            ],
          },
          {
            name: "Pateros",
            postalCode: "1620",
            barangays: [
              "Aguho", "Magtanggol", "Martirez del 96", "Poblacion", "San Pedro",
              "San Roque", "Santa Ana", "Santo Rosario-Kanluran", "Santo Rosario-Silangan", "Tabacalera"
            ],
          },
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
              "Asin Road", "Aurora Hill", "Bakakeng Central", "Camp 7", "Camp 8",
              "City Camp Central", "Engineers' Hill", "Gibraltar", "Irisan", "Kias",
              "Loakan Proper", "Mines View Park", "Pacdal", "Pinsao Proper", "Quirino Hill",
              "San Luis Village", "San Vicente", "Scout Barrio", "Session Road", "Trancoville"
            ],
          },
          { name: "La Trinidad", postalCode: "2601", barangays: ["Balili", "Betag", "Poblacion", "Puguis", "Wangal"] },
          { name: "Itogon", postalCode: "2604" },
          { name: "Tuba", postalCode: "2603" },
          { name: "Tublay", postalCode: "2615" },
          { name: "Buguias", postalCode: "2607" },
          { name: "Mankayan", postalCode: "2608" },
        ],
      },
      {
        name: "Abra",
        cities: [
          { name: "Bangued (Capital)", postalCode: "2800" },
          { name: "Bucay", postalCode: "2805" },
          { name: "Dolores", postalCode: "2801" },
          { name: "La Paz", postalCode: "2826" },
          { name: "Tayum", postalCode: "2803" },
        ],
      },
      {
        name: "Apayao",
        cities: [
          { name: "Kabugao (Capital)", postalCode: "3809" },
          { name: "Conner", postalCode: "3807" },
          { name: "Flora", postalCode: "3810" },
          { name: "Luna", postalCode: "3813" },
          { name: "Pudtol", postalCode: "3812" },
        ],
      },
      {
        name: "Ifugao",
        cities: [
          { name: "Lagawe (Capital)", postalCode: "3600" },
          { name: "Banaue", postalCode: "3601" },
          { name: "Kiangan", postalCode: "3604" },
          { name: "Alfonso Lista", postalCode: "3608" },
          { name: "Lamut", postalCode: "3605" },
        ],
      },
      {
        name: "Kalinga",
        cities: [
          { name: "Tabuk City (Capital)", postalCode: "3800" },
          { name: "Balbalan", postalCode: "3801" },
          { name: "Lubuagan", postalCode: "3802" },
          { name: "Pasil", postalCode: "3803" },
          { name: "Pinukpuk", postalCode: "3804" },
          { name: "Rizal", postalCode: "3808" },
        ],
      },
      {
        name: "Mountain Province",
        cities: [
          { name: "Bontoc (Capital)", postalCode: "2616" },
          { name: "Sagada", postalCode: "2619" },
          { name: "Bauko", postalCode: "2621" },
          { name: "Besao", postalCode: "2618" },
          { name: "Tadian", postalCode: "2620" },
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
          { name: "Cabugao", postalCode: "2732" },
        ],
      },
      {
        name: "La Union",
        cities: [
          { name: "San Fernando City (Capital)", postalCode: "2500" },
          { name: "Agoo", postalCode: "2504" },
          { name: "Bauang", postalCode: "2501" },
          { name: "San Juan", postalCode: "2514" },
          { name: "Nagilian", postalCode: "2511" },
        ],
      },
      {
        name: "Pangasinan",
        cities: [
          { name: "Dagupan City", postalCode: "2400" },
          { name: "San Carlos City", postalCode: "2420" },
          { name: "Urdaneta City", postalCode: "2428" },
          { name: "Alaminos City", postalCode: "2404" },
          { name: "Lingayen (Capital)", postalCode: "2401" },
          { name: "Rosales", postalCode: "2441" },
          { name: "Malasiqui", postalCode: "2421" },
          { name: "Bayambang", postalCode: "2423" },
          { name: "Mangaldan", postalCode: "2432" },
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
          { name: "Baggao", postalCode: "3506" },
          { name: "Solana", postalCode: "3503" },
        ],
      },
      {
        name: "Isabela",
        cities: [
          { name: "Ilagan City (Capital)", postalCode: "3300" },
          { name: "Santiago City", postalCode: "3311" },
          { name: "Cauayan City", postalCode: "3305" },
          { name: "Roxas", postalCode: "3320" },
          { name: "Tumauini", postalCode: "3325" },
          { name: "San Mateo", postalCode: "3318" },
        ],
      },
      {
        name: "Nueva Vizcaya",
        cities: [
          { name: "Bayombong (Capital)", postalCode: "3700" },
          { name: "Solano", postalCode: "3709" },
          { name: "Bambang", postalCode: "3702" },
          { name: "Aritao", postalCode: "3704" },
        ],
      },
      {
        name: "Quirino",
        cities: [
          { name: "Cabarroguis (Capital)", postalCode: "3400" },
          { name: "Diffun", postalCode: "3401" },
          { name: "Maddela", postalCode: "3404" },
          { name: "Saguday", postalCode: "3402" },
        ],
      },
      {
        name: "Batanes",
        cities: [
          { name: "Basco (Capital)", postalCode: "3900" },
          { name: "Mahatao", postalCode: "3901" },
          { name: "Ivana", postalCode: "3902" },
          { name: "Uyugan", postalCode: "3903" },
          { name: "Sabtang", postalCode: "3904" },
          { name: "Itbayat", postalCode: "3905" },
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
          { name: "Mabalacat City", postalCode: "2010" },
          { name: "Guagua", postalCode: "2003" },
          { name: "Lubao", postalCode: "2005" },
          { name: "Mexico", postalCode: "2021" },
          { name: "Arayat", postalCode: "2012" },
          { name: "Porac", postalCode: "2008" },
          { name: "Floridablanca", postalCode: "2006" },
          { name: "Apalit", postalCode: "2016" },
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
          { name: "Guiguinto", postalCode: "3015" },
          { name: "Bocaue", postalCode: "3018" },
          { name: "Plaridel", postalCode: "3004" },
          { name: "Pulilan", postalCode: "3005" },
          { name: "Hagonoy", postalCode: "3002" },
          { name: "Calumpit", postalCode: "3003" },
          { name: "San Miguel", postalCode: "3011" },
        ],
      },
      {
        name: "Bataan",
        cities: [
          { name: "Balanga City (Capital)", postalCode: "2100" },
          { name: "Dinalupihan", postalCode: "2110" },
          { name: "Mariveles", postalCode: "2105" },
          { name: "Hermosa", postalCode: "2111" },
          { name: "Orani", postalCode: "2112" },
          { name: "Limay", postalCode: "2103" },
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
          { name: "Guimba", postalCode: "3115" },
          { name: "Talavera", postalCode: "3114" },
          { name: "San Leonardo", postalCode: "3102" },
          { name: "Santa Rosa", postalCode: "3101" },
        ],
      },
      {
        name: "Tarlac",
        cities: [
          { name: "Tarlac City (Capital)", postalCode: "2300" },
          { name: "Capas", postalCode: "2315" },
          { name: "Concepcion", postalCode: "2316" },
          { name: "Paniqui", postalCode: "2307" },
          { name: "Gerona", postalCode: "2302" },
          { name: "Camiling", postalCode: "2306" },
          { name: "Bamban", postalCode: "2317" },
        ],
      },
      {
        name: "Zambales",
        cities: [
          { name: "Olongapo City", postalCode: "2200" },
          { name: "Iba (Capital)", postalCode: "2201" },
          { name: "Subic", postalCode: "2209" },
          { name: "Castillejos", postalCode: "2208" },
          { name: "San Marcelino", postalCode: "2207" },
          { name: "Botolan", postalCode: "2202" },
        ],
      },
      {
        name: "Aurora",
        cities: [
          { name: "Baler (Capital)", postalCode: "3200" },
          { name: "Casiguran", postalCode: "3204" },
          { name: "Dipaculao", postalCode: "3203" },
          { name: "Maria Aurora", postalCode: "3202" },
          { name: "San Luis", postalCode: "3201" },
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
          { name: "Rosario", postalCode: "4106" },
          { name: "Naic", postalCode: "4110" },
          { name: "Indang", postalCode: "4122" },
          { name: "Alfonso", postalCode: "4123" },
          { name: "Amadeo", postalCode: "4119" },
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
          { name: "Bay", postalCode: "4033" },
          { name: "Alaminos", postalCode: "4001" },
          { name: "Nagcarlan", postalCode: "4002" },
          { name: "Liliw", postalCode: "4004" },
          { name: "Siniloan", postalCode: "4019" },
          { name: "Paete", postalCode: "4016" },
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
          { name: "Balayan", postalCode: "4213" },
          { name: "Bauan", postalCode: "4201" },
          { name: "Calaca City", postalCode: "4212" },
          { name: "Lemery", postalCode: "4209" },
          { name: "Taal", postalCode: "4208" },
          { name: "San Juan", postalCode: "4226" },
          { name: "Rosario", postalCode: "4225" },
          { name: "San Jose", postalCode: "4227" },
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
          { name: "Tanay", postalCode: "1980" },
          { name: "Morong", postalCode: "1970" },
          { name: "Cardona", postalCode: "1950" },
          { name: "Baras", postalCode: "1970" },
          { name: "Pililla", postalCode: "1910" },
          { name: "Teresa", postalCode: "1960" },
        ],
      },
      {
        name: "Quezon",
        cities: [
          { name: "Lucena City (Capital)", postalCode: "4301" },
          { name: "Tayabas City", postalCode: "4327" },
          { name: "Candelaria", postalCode: "4323" },
          { name: "Sariaya", postalCode: "4322" },
          { name: "Tiaong", postalCode: "4325" },
          { name: "Pagbilao", postalCode: "4302" },
          { name: "Lucban", postalCode: "4328" },
          { name: "Gumaca", postalCode: "4307" },
          { name: "Lopez", postalCode: "4316" },
          { name: "Atimonan", postalCode: "4331" },
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
          { name: "Brooke's Point", postalCode: "5305" },
          { name: "Narra", postalCode: "5303" },
          { name: "Roxas", postalCode: "5308" },
          { name: "Taytay", postalCode: "5312" },
        ],
      },
      {
        name: "Oriental Mindoro",
        cities: [
          { name: "Calapan City (Capital)", postalCode: "5200" },
          { name: "Puerto Galera", postalCode: "5203" },
          { name: "Naujan", postalCode: "5204" },
          { name: "Pinamalayan", postalCode: "5208" },
          { name: "Roxas", postalCode: "5212" },
        ],
      },
      {
        name: "Occidental Mindoro",
        cities: [
          { name: "Mamburao (Capital)", postalCode: "5106" },
          { name: "San Jose", postalCode: "5100" },
          { name: "Sablayan", postalCode: "5104" },
          { name: "Santa Cruz", postalCode: "5105" },
        ],
      },
      {
        name: "Marinduque",
        cities: [
          { name: "Boac (Capital)", postalCode: "4900" },
          { name: "Mogpog", postalCode: "4901" },
          { name: "Santa Cruz", postalCode: "4902" },
          { name: "Torrijos", postalCode: "4903" },
          { name: "Gasan", postalCode: "4905" },
          { name: "Buenavista", postalCode: "4904" },
        ],
      },
      {
        name: "Romblon",
        cities: [
          { name: "Romblon (Capital)", postalCode: "5500" },
          { name: "Odiongan", postalCode: "5505" },
          { name: "San Agustin", postalCode: "5501" },
          { name: "Cajidiocan", postalCode: "5512" },
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
          { name: "Guinobatan", postalCode: "4503" },
          { name: "Camalig", postalCode: "4502" },
          { name: "Polangui", postalCode: "4506" },
          { name: "Oas", postalCode: "4505" },
          { name: "Tiwi", postalCode: "4513" },
        ],
      },
      {
        name: "Camarines Sur",
        cities: [
          { name: "Naga City", postalCode: "4400" },
          { name: "Pili (Capital)", postalCode: "4418" },
          { name: "Iriga City", postalCode: "4431" },
          { name: "Libmanan", postalCode: "4407" },
          { name: "Calabanga", postalCode: "4405" },
          { name: "Baao", postalCode: "4432" },
          { name: "Bula", postalCode: "4430" },
          { name: "Nabua", postalCode: "4434" },
          { name: "Sipocot", postalCode: "4408" },
        ],
      },
      {
        name: "Camarines Norte",
        cities: [
          { name: "Daet (Capital)", postalCode: "4600" },
          { name: "Labo", postalCode: "4604" },
          { name: "Jose Panganiban", postalCode: "4606" },
          { name: "Basud", postalCode: "4608" },
          { name: "Vinzons", postalCode: "4603" },
        ],
      },
      {
        name: "Sorsogon",
        cities: [
          { name: "Sorsogon City (Capital)", postalCode: "4700" },
          { name: "Bulan", postalCode: "4706" },
          { name: "Gubat", postalCode: "4710" },
          { name: "Irosin", postalCode: "4707" },
          { name: "Pilar", postalCode: "4714" },
        ],
      },
      {
        name: "Catanduanes",
        cities: [
          { name: "Virac (Capital)", postalCode: "4800" },
          { name: "San Andres", postalCode: "4810" },
          { name: "Bato", postalCode: "4801" },
          { name: "Caramoran", postalCode: "4808" },
          { name: "Pandan", postalCode: "4809" },
        ],
      },
      {
        name: "Masbate",
        cities: [
          { name: "Masbate City (Capital)", postalCode: "5400" },
          { name: "Aroroy", postalCode: "5414" },
          { name: "Milagros", postalCode: "5410" },
          { name: "Placer", postalCode: "5408" },
          { name: "Cawayan", postalCode: "5409" },
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
            barangays: [
              "Arevalo", "City Proper", "Jaro", "La Paz", "Lapuz", "Mandurriao", "Molo",
              "Bakhaw", "Balantang", "Bolilao", "Buntatala", "Calumpang", "Dungon A", "Dungon B",
              "MH del Pilar", "Nabitasan", "Obrero", "San Rafael", "Santa Rosa", "Tabuc Suba"
            ],
          },
          { name: "Passi City", postalCode: "5037" },
          { name: "Oton", postalCode: "5020" },
          { name: "Pavia", postalCode: "5001" },
          { name: "Santa Barbara", postalCode: "5002" },
          { name: "Pototan", postalCode: "5008" },
          { name: "Dumangas", postalCode: "5006" },
          { name: "Miagao", postalCode: "5023" },
          { name: "Guimbal", postalCode: "5022" },
          { name: "Cabatuan", postalCode: "5031" },
        ],
      },
      {
        name: "Negros Occidental",
        cities: [
          {
            name: "Bacolod City (Capital)",
            postalCode: "6100",
            barangays: [
              "Barangay 1 - 41", "Alangilan", "Alijis", "Banago", "Bata", "Cabug",
              "Estefania", "Felisa", "Granada", "Handumanan", "Mandalagan", "Mansilingan",
              "Montevista", "Pahanocoy", "Punta Taytay", "Singcang-Airport", "Sum-ag", "Taculing", "Tangub", "Villamonte", "Vista Alegre"
            ],
          },
          { name: "Bago City", postalCode: "6101" },
          { name: "Cadiz City", postalCode: "6121" },
          { name: "Escalante City", postalCode: "6124" },
          { name: "Himamaylan City", postalCode: "6108" },
          { name: "Kabankalan City", postalCode: "6111" },
          { name: "La Carlota City", postalCode: "6130" },
          { name: "Sagay City", postalCode: "6122" },
          { name: "San Carlos City", postalCode: "6127" },
          { name: "Silay City", postalCode: "6116" },
          { name: "Sipalay City", postalCode: "6113" },
          { name: "Talisay City", postalCode: "6115" },
          { name: "Victorias City", postalCode: "6119" },
        ],
      },
      {
        name: "Capiz",
        cities: [
          { name: "Roxas City (Capital)", postalCode: "5800" },
          { name: "Panay", postalCode: "5801" },
          { name: "Pontevedra", postalCode: "5802" },
          { name: "Dumalag", postalCode: "5813" },
          { name: "Mambusao", postalCode: "5807" },
          { name: "Tapaz", postalCode: "5814" },
        ],
      },
      {
        name: "Aklan",
        cities: [
          { name: "Kalibo (Capital)", postalCode: "5600" },
          { name: "Malay (Boracay Island)", postalCode: "5608" },
          { name: "Numancia", postalCode: "5604" },
          { name: "Ibajay", postalCode: "5613" },
          { name: "New Washington", postalCode: "5610" },
          { name: "Banga", postalCode: "5601" },
        ],
      },
      {
        name: "Antique",
        cities: [
          { name: "San Jose de Buenavista (Capital)", postalCode: "5700" },
          { name: "Sibalom", postalCode: "5701" },
          { name: "Hamtic", postalCode: "5715" },
          { name: "Culasi", postalCode: "5708" },
          { name: "Pandan", postalCode: "5712" },
        ],
      },
      {
        name: "Guimaras",
        cities: [
          { name: "Jordan (Capital)", postalCode: "5045" },
          { name: "Buenavista", postalCode: "5044" },
          { name: "Nueva Valencia", postalCode: "5046" },
          { name: "San Lorenzo", postalCode: "5047" },
          { name: "Sibunag", postalCode: "5048" },
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
              "Apas (IT Park)", "Banilad", "Basak Pardo", "Basak San Nicolas", "Buhisan",
              "Bulacao", "Busay", "Calamba", "Camputhaw", "Capitol Site", "Carreta",
              "Cogon Ramos", "Day-as", "Guadalupe", "Inayawan", "Kalunasan", "Kamagayan",
              "Kasambagan", "Kinasang-an Pardo", "Labangon", "Lahug", "Lorega San Miguel",
              "Mabolo", "Mambaling", "Pahina Central", "Pari-an", "Pasil", "Pit-os",
              "Poblacion Pardo", "Punta Princesa", "Quiot Pardo", "Sambag I", "Sambag II",
              "San Antonio", "San Jose", "San Nicolas Proper", "San Roque", "Santa Cruz",
              "Santo Niño", "Suba", "Talamban", "Tejero", "Tinago", "Tisa", "Zapatera"
            ],
          },
          {
            name: "Mandaue City",
            postalCode: "6014",
            barangays: [
              "Alang-alang", "Bakilid", "Banilad", "Basak", "Cabancalan", "Cambaro",
              "Canduman", "Casili", "Casuntingan", "Centro (Poblacion)", "Guizo",
              "Ibabao-Estancia", "Jagobiao", "Labogon", "Looc", "Maguikay", "Mantuyong",
              "Opao", "Paknaan", "Pagsabungan", "Subangdaku", "Tabok", "Tawason", "Tingub", "Tipolo", "Umapad"
            ],
          },
          {
            name: "Lapu-Lapu City (Opon)",
            postalCode: "6015",
            barangays: [
              "Agus", "Babag", "Bankal", "Basak", "Buaya", "Calawisan", "Canjulao",
              "Gun-ob", "Ibo (MEPZ)", "Looc", "Mactan", "Maribago", "Marigondon",
              "Pajac", "Pajo", "Poblacion", "Punta Engaño", "Pusok", "Subabasbas"
            ],
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
          { name: "Compostela", postalCode: "6003" },
          { name: "Cordova", postalCode: "6017" },
          { name: "Balamban", postalCode: "6041" },
          { name: "Bantayan", postalCode: "6042" },
          { name: "San Fernando", postalCode: "6018" },
        ],
      },
      {
        name: "Bohol",
        cities: [
          { name: "Tagbilaran City (Capital)", postalCode: "6300" },
          { name: "Panglao", postalCode: "6340" },
          { name: "Dauis", postalCode: "6339" },
          { name: "Tubigon", postalCode: "6329" },
          { name: "Talibon", postalCode: "6325" },
          { name: "Ubay", postalCode: "6315" },
          { name: "Carmen (Chocolate Hills)", postalCode: "6319" },
          { name: "Loon", postalCode: "6327" },
          { name: "Jagana", postalCode: "6308" },
        ],
      },
      {
        name: "Negros Oriental",
        cities: [
          { name: "Dumaguete City (Capital)", postalCode: "6200" },
          { name: "Bais City", postalCode: "6206" },
          { name: "Bayawan City", postalCode: "6221" },
          { name: "Canlaon City", postalCode: "6223" },
          { name: "Guihulngan City", postalCode: "6214" },
          { name: "Tanjay City", postalCode: "6204" },
          { name: "Sibulan", postalCode: "6201" },
          { name: "Valencia", postalCode: "6215" },
          { name: "Bacong", postalCode: "6216" },
        ],
      },
      {
        name: "Siquijor",
        cities: [
          { name: "Siquijor (Capital)", postalCode: "6225" },
          { name: "Larena", postalCode: "6226" },
          { name: "Lazi", postalCode: "6228" },
          { name: "San Juan", postalCode: "6227" },
          { name: "Enrique Villanueva", postalCode: "6230" },
          { name: "Maria", postalCode: "6229" },
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
          { name: "Tanauan", postalCode: "6502" },
          { name: "Carigara", postalCode: "6529" },
          { name: "Alangalang", postalCode: "6517" },
          { name: "Hilongos", postalCode: "6524" },
        ],
      },
      {
        name: "Southern Leyte",
        cities: [
          { name: "Maasin City (Capital)", postalCode: "6600" },
          { name: "Sogod", postalCode: "6606" },
          { name: "Macrohon", postalCode: "6601" },
          { name: "Hinunangan", postalCode: "6608" },
          { name: "Bontoc", postalCode: "6604" },
        ],
      },
      {
        name: "Samar (Western Samar)",
        cities: [
          { name: "Catbalogan City (Capital)", postalCode: "6700" },
          { name: "Calbayog City", postalCode: "6710" },
          { name: "Basey", postalCode: "6720" },
          { name: "Paranas", postalCode: "6703" },
          { name: "Gandara", postalCode: "6706" },
        ],
      },
      {
        name: "Eastern Samar",
        cities: [
          { name: "Borongan City (Capital)", postalCode: "6800" },
          { name: "Guiuan", postalCode: "6809" },
          { name: "Dolores", postalCode: "6817" },
          { name: "Oras", postalCode: "6818" },
          { name: "Balangiga", postalCode: "6812" },
        ],
      },
      {
        name: "Northern Samar",
        cities: [
          { name: "Catarman (Capital)", postalCode: "6400" },
          { name: "Laoang", postalCode: "6411" },
          { name: "Allen", postalCode: "6405" },
          { name: "San Jose", postalCode: "6402" },
          { name: "Palapag", postalCode: "6421" },
        ],
      },
      {
        name: "Biliran",
        cities: [
          { name: "Naval (Capital)", postalCode: "6560" },
          { name: "Kawayan", postalCode: "6562" },
          { name: "Almeria", postalCode: "6561" },
          { name: "Biliran", postalCode: "6566" },
          { name: "Caibiran", postalCode: "6563" },
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
            barangays: [
              "Ayala", "Baliwasan", "Boalan", "Calarian", "Canelar", "Divisoria",
              "Guiwan", "Mercedes", "Pasonanca", "Putik", "San Jose Cawa-Cawa",
              "San Jose Gusu", "San Roque", "Santa Maria", "Tetuan", "Tumaga", "Zone I - IV"
            ],
          },
          { name: "Pagadian City (Capital)", postalCode: "7016" },
          { name: "Aurora", postalCode: "7020" },
          { name: "Molave", postalCode: "7023" },
          { name: "Dumalinao", postalCode: "7015" },
          { name: "San Miguel", postalCode: "7029" },
        ],
      },
      {
        name: "Zamboanga del Norte",
        cities: [
          { name: "Dipolog City (Capital)", postalCode: "7100" },
          { name: "Dapitan City", postalCode: "7101" },
          { name: "Sindangan", postalCode: "7112" },
          { name: "Siocon", postalCode: "7120" },
          { name: "Labason", postalCode: "7117" },
        ],
      },
      {
        name: "Zamboanga Sibugay",
        cities: [
          { name: "Ipil (Capital)", postalCode: "7001" },
          { name: "Titay", postalCode: "7003" },
          { name: "Kabasalan", postalCode: "7005" },
          { name: "Imelda", postalCode: "7007" },
          { name: "Buug", postalCode: "7009" },
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
            barangays: [
              "Barangay 1 - 40", "Balulang", "Bulua", "Camaman-an", "Canito-an",
              "Carmen", "Consolacion", "Gusa", "Iponan", "Kauswagan", "Lapasan",
              "Macabalan", "Macasandig", "Nazareth", "Patag", "Puerto", "Puntod", "Tablon"
            ],
          },
          { name: "Gingoog City", postalCode: "9014" },
          { name: "El Salvador City", postalCode: "9017" },
          { name: "Tagoloan", postalCode: "9001" },
          { name: "Villanueva", postalCode: "9002" },
          { name: "Jasaan", postalCode: "9003" },
          { name: "Balingasag", postalCode: "9005" },
          { name: "Opol", postalCode: "9016" },
          { name: "Initao", postalCode: "9022" },
        ],
      },
      {
        name: "Bukidnon",
        cities: [
          { name: "Malaybalay City (Capital)", postalCode: "8700" },
          { name: "Valencia City", postalCode: "8709" },
          { name: "Manolo Fortich", postalCode: "8703" },
          { name: "Maramag", postalCode: "8714" },
          { name: "Quezon", postalCode: "8715" },
          { name: "Don Carlos", postalCode: "8712" },
        ],
      },
      {
        name: "Lanao del Norte",
        cities: [
          { name: "Iligan City", postalCode: "9200" },
          { name: "Tubod (Capital)", postalCode: "9209" },
          { name: "Kapatagan", postalCode: "9214" },
          { name: "Lala", postalCode: "9211" },
          { name: "Baroy", postalCode: "9210" },
        ],
      },
      {
        name: "Misamis Occidental",
        cities: [
          { name: "Oroquieta City (Capital)", postalCode: "7207" },
          { name: "Ozamiz City", postalCode: "7200" },
          { name: "Tangub City", postalCode: "7214" },
          { name: "Plaridel", postalCode: "7209" },
          { name: "Calamba", postalCode: "7210" },
          { name: "Clarin", postalCode: "7201" },
        ],
      },
      {
        name: "Camiguin",
        cities: [
          { name: "Mambajao (Capital)", postalCode: "9100" },
          { name: "Catarman", postalCode: "9104" },
          { name: "Guinsiliban", postalCode: "9102" },
          { name: "Mahinog", postalCode: "9101" },
          { name: "Sagay", postalCode: "9103" },
        ],
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
              "Agdao", "Bago Aplaya", "Bago Gallera", "Bajada", "Bangkas Heights",
              "Bucana (76-A)", "Buhangin", "Bunawan", "Cabantian", "Calinan",
              "Catalunan Grande", "Catalunan Pequeño", "Communal", "Dumoy", "Indangan",
              "Lanang", "Lasang", "Ma-a", "Mabuhay", "Magtuod", "Mandug", "Marapangi",
              "Matina Aplaya", "Matina Crossing", "Matina Pangi", "Mintal", "Mudiang",
              "Panacan", "Poblacion (Barangay 1-40)", "Puan", "Sasa", "Sirawan",
              "Talomo Proper", "Tibungco", "Toril Proper", "Tugbok", "Waan"
            ],
          },
          { name: "Digos City (Capital)", postalCode: "8002" },
          { name: "Santa Cruz", postalCode: "8001" },
          { name: "Bansalan", postalCode: "8005" },
          { name: "Hagonoy", postalCode: "8006" },
          { name: "Matanao", postalCode: "8003" },
          { name: "Malalag", postalCode: "8010" },
          { name: "Sulop", postalCode: "8009" },
          { name: "Padada", postalCode: "8007" },
        ],
      },
      {
        name: "Davao del Norte",
        cities: [
          { name: "Tagum City (Capital)", postalCode: "8100" },
          { name: "Panabo City", postalCode: "8105" },
          { name: "Island Garden City of Samal", postalCode: "8119" },
          { name: "Carmen", postalCode: "8101" },
          { name: "Kapalong", postalCode: "8113" },
          { name: "Santo Tomas", postalCode: "8112" },
          { name: "Asuncion", postalCode: "8102" },
          { name: "New Corella", postalCode: "8104" },
        ],
      },
      {
        name: "Davao de Oro",
        cities: [
          { name: "Nabunturan (Capital)", postalCode: "8800" },
          { name: "Monkayo", postalCode: "8805" },
          { name: "Compostela", postalCode: "8803" },
          { name: "Pantukan", postalCode: "8809" },
          { name: "Mawab", postalCode: "8802" },
          { name: "Maco", postalCode: "8806" },
          { name: "Maragusan", postalCode: "8808" },
          { name: "Laak", postalCode: "8810" },
        ],
      },
      {
        name: "Davao Oriental",
        cities: [
          { name: "Mati City (Capital)", postalCode: "8200" },
          { name: "Lupon", postalCode: "8207" },
          { name: "Banaybanay", postalCode: "8208" },
          { name: "Baganga", postalCode: "8204" },
          { name: "Cateel", postalCode: "8205" },
          { name: "Governor Generoso", postalCode: "8210" },
        ],
      },
      {
        name: "Davao Occidental",
        cities: [
          { name: "Malita (Capital)", postalCode: "8012" },
          { name: "Santa Maria", postalCode: "8011" },
          { name: "Don Marcelino", postalCode: "8013" },
          { name: "Jose Abad Santos", postalCode: "8014" },
          { name: "Sarangani", postalCode: "8015" },
        ],
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
            barangays: [
              "Apopong", "Baluan", "Bula", "Calumpang", "City Heights", "Conel",
              "Dadiangas East", "Dadiangas North", "Dadiangas South", "Dadiangas West",
              "Fatima", "Katangawan", "Lagao", "Labangal", "Mabuhay", "San Isidro",
              "San Jose", "Sinawal", "Tambler", "Tinagacan", "Upper Labay"
            ],
          },
          { name: "Koronadal City (Capital)", postalCode: "9506" },
          { name: "Polomolok", postalCode: "9504" },
          { name: "Tupi", postalCode: "9505" },
          { name: "Surallah", postalCode: "9512" },
          { name: "Banga", postalCode: "9511" },
          { name: "Norala", postalCode: "9508" },
          { name: "T'Boli", postalCode: "9513" },
          { name: "Lake Sebu", postalCode: "9514" },
        ],
      },
      {
        name: "Cotabato (North Cotabato)",
        cities: [
          { name: "Kidapawan City (Capital)", postalCode: "9400" },
          { name: "Midsayap", postalCode: "9410" },
          { name: "Pikit", postalCode: "9409" },
          { name: "Kabacan", postalCode: "9407" },
          { name: "Makilala", postalCode: "9401" },
          { name: "Carmen", postalCode: "9408" },
          { name: "Tulunan", postalCode: "9403" },
        ],
      },
      {
        name: "Sultan Kudarat",
        cities: [
          { name: "Tacurong City", postalCode: "9800" },
          { name: "Isulan (Capital)", postalCode: "9805" },
          { name: "Lebak", postalCode: "9807" },
          { name: "Esperanza", postalCode: "9806" },
          { name: "Kalamansig", postalCode: "9808" },
          { name: "President Quirino", postalCode: "9804" },
        ],
      },
      {
        name: "Sarangani",
        cities: [
          { name: "Alabel (Capital)", postalCode: "9501" },
          { name: "Glan", postalCode: "9517" },
          { name: "Malungon", postalCode: "9503" },
          { name: "Kiamba", postalCode: "9514" },
          { name: "Maitum", postalCode: "9515" },
          { name: "Maasim", postalCode: "9502" },
          { name: "Malapatan", postalCode: "9516" },
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
          { name: "Buenavista", postalCode: "8601" },
          { name: "Nasipit", postalCode: "8602" },
          { name: "Carmen", postalCode: "8603" },
          { name: "Tubay", postalCode: "8606" },
        ],
      },
      {
        name: "Agusan del Sur",
        cities: [
          { name: "Prosperidad (Capital)", postalCode: "8500" },
          { name: "Bayugan City", postalCode: "8502" },
          { name: "San Francisco", postalCode: "8501" },
          { name: "Trento", postalCode: "8505" },
          { name: "Bunawan", postalCode: "8506" },
          { name: "Esperanza", postalCode: "8513" },
        ],
      },
      {
        name: "Surigao del Norte",
        cities: [
          { name: "Surigao City (Capital)", postalCode: "8400" },
          { name: "General Luna (Siargao)", postalCode: "8419" },
          { name: "Dapa (Siargao)", postalCode: "8417" },
          { name: "Del Carmen", postalCode: "8418" },
          { name: "Mainit", postalCode: "8407" },
          { name: "Placer", postalCode: "8405" },
        ],
      },
      {
        name: "Surigao del Sur",
        cities: [
          { name: "Tandag City (Capital)", postalCode: "8300" },
          { name: "Bislig City", postalCode: "8311" },
          { name: "Hinatuan (Enchanted River)", postalCode: "8310" },
          { name: "Barobo", postalCode: "8309" },
          { name: "Cantilan", postalCode: "8317" },
          { name: "San Miguel", postalCode: "8301" },
        ],
      },
      {
        name: "Dinagat Islands",
        cities: [
          { name: "San Jose (Capital)", postalCode: "8427" },
          { name: "Dinagat", postalCode: "8412" },
          { name: "Basilisa", postalCode: "8413" },
          { name: "Cagdianao", postalCode: "8411" },
          { name: "Tubajon", postalCode: "8426" },
          { name: "Libjo", postalCode: "8414" },
          { name: "Loreto", postalCode: "8415" },
        ],
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
          { name: "Parang", postalCode: "9604" },
          { name: "Sultan Kudarat", postalCode: "9605" },
          { name: "Upi", postalCode: "9602" },
        ],
      },
      {
        name: "Maguindanao del Sur",
        cities: [
          { name: "Buluan (Capital)", postalCode: "9616" },
          { name: "Shariff Aguak", postalCode: "9608" },
          { name: "Datu Paglas", postalCode: "9617" },
          { name: "Sultan sa Barongis", postalCode: "9611" },
          { name: "Ampatuan", postalCode: "9609" },
        ],
      },
      {
        name: "Lanao del Sur",
        cities: [
          { name: "Marawi City (Capital)", postalCode: "9700" },
          { name: "Malabang", postalCode: "9300" },
          { name: "Wao", postalCode: "9716" },
          { name: "Balabagan", postalCode: "9302" },
          { name: "Kapai", postalCode: "9709" },
        ],
      },
      {
        name: "Basilan",
        cities: [
          { name: "Isabela City", postalCode: "7300" },
          { name: "Lamitan City (Capital)", postalCode: "7302" },
          { name: "Maluso", postalCode: "7303" },
          { name: "Tipo-Tipo", postalCode: "7304" },
          { name: "Sumisip", postalCode: "7305" },
        ],
      },
      {
        name: "Sulu",
        cities: [
          { name: "Jolo (Capital)", postalCode: "7400" },
          { name: "Indanan", postalCode: "7407" },
          { name: "Parang", postalCode: "7408" },
          { name: "Siasi", postalCode: "7412" },
          { name: "Maimbung", postalCode: "7409" },
        ],
      },
      {
        name: "Tawi-Tawi",
        cities: [
          { name: "Bongao (Capital)", postalCode: "7500" },
          { name: "Panglima Sugala", postalCode: "7501" },
          { name: "Simunul", postalCode: "7505" },
          { name: "Sitangkai", postalCode: "7506" },
          { name: "Languyan", postalCode: "7509" },
        ],
      },
    ],
  },
];

// ── Helper Lookup Functions ──────────────────────────────────────────────────

export function getPhilippineRegions(): RegionData[] {
  return PHILIPPINE_REGIONS;
}

export function findRegion(regionNameOrCode: string): RegionData | undefined {
  if (!regionNameOrCode) return undefined;
  const q = regionNameOrCode.trim().toLowerCase();

  // 1. Exact match on code (e.g. "Region XI", "NCR")
  const byCode = PHILIPPINE_REGIONS.find((r) => r.code.toLowerCase() === q);
  if (byCode) return byCode;

  // 2. Exact match on full name (e.g. "Region XI – Davao Region" or "Region XI - Davao Region")
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
