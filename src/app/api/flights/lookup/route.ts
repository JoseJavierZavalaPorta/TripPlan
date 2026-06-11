// src/app/api/flights/lookup/route.ts
import { NextResponse } from 'next/server';

const AIRLINE_NAMES: Record<string, string> = {
  LA: 'LATAM Airlines', LC: 'LC Perú', '4M': 'LCBusre',
  AV: 'Avianca', AA: 'American Airlines', UA: 'United Airlines',
  DL: 'Delta Air Lines', IB: 'Iberia', KL: 'KLM',
  AF: 'Air France', BA: 'British Airways', LH: 'Lufthansa',
  QR: 'Qatar Airways', EK: 'Emirates', TK: 'Turkish Airlines',
  G3: 'Gol', AD: 'Azul', JJ: 'LATAM Brasil',
  CM: 'Copa Airlines', AM: 'Aeroméxico', UX: 'Air Europa',
  Y4: 'Volaris', VB: 'VivaAerobus', W4: 'Sky Airline',
  H2: 'Sky Airline', JA: 'JetSMART', P9: 'Peruvian Airlines',
  T7: '2B Connect', SK: 'SAS', AY: 'Finnair',
  OS: 'Austrian Airlines', SN: 'Brussels Airlines', LX: 'Swiss',
  EI: 'Aer Lingus', TP: 'TAP Air Portugal', A3: 'Aegean Airlines',
  AB: 'Air Berlin', FR: 'Ryanair', U2: 'easyJet',
  W6: 'Wizz Air', VY: 'Vueling', BT: 'airBaltic',
  WY: 'Oman Air', GF: 'Gulf Air', SV: 'Saudi Arabian Airlines',
  ET: 'Ethiopian Airlines', MS: 'EgyptAir', AT: 'Royal Air Maroc',
  CX: 'Cathay Pacific', SQ: 'Singapore Airlines', NH: 'ANA',
  JL: 'Japan Airlines', OZ: 'Asiana Airlines', KE: 'Korean Air',
  CI: 'China Airlines', MH: 'Malaysia Airlines', GA: 'Garuda Indonesia',
  QF: 'Qantas', NZ: 'Air New Zealand',
};

const AIRPORT_CITIES: Record<string, string> = {
  // Perú
  LIM: 'Lima', CUZ: 'Cusco', AQP: 'Arequipa', TRU: 'Trujillo',
  PIU: 'Piura', IQT: 'Iquitos', JUL: 'Juliaca', CIX: 'Chiclayo',
  PEM: 'Puerto Maldonado', TCQ: 'Tacna', HUZ: 'Huánuco',
  // Colombia
  BOG: 'Bogotá', MDE: 'Medellín', CLO: 'Cali', CTG: 'Cartagena',
  BAQ: 'Barranquilla', SMR: 'Santa Marta',
  // Brasil
  GRU: 'São Paulo', CGH: 'São Paulo (Congonhas)', GIG: 'Rio de Janeiro',
  SDU: 'Rio de Janeiro (Santos Dumont)', BSB: 'Brasília', SSA: 'Salvador',
  FOR: 'Fortaleza', REC: 'Recife', CWB: 'Curitiba', POA: 'Porto Alegre',
  BEL: 'Belém', MAO: 'Manaos',
  // Argentina
  EZE: 'Buenos Aires', AEP: 'Buenos Aires (Aeroparque)', COR: 'Córdoba',
  MDZ: 'Mendoza', BRC: 'Bariloche', IGR: 'Puerto Iguazú',
  // Chile
  SCL: 'Santiago', PMC: 'Puerto Montt', ANF: 'Antofagasta',
  IQQ: 'Iquique', ESC: 'Punta Arenas', ZPC: 'Pucón',
  // Ecuador
  UIO: 'Quito', GYE: 'Guayaquil', GPS: 'Galápagos',
  // Bolivia
  LPB: 'La Paz', VVI: 'Santa Cruz', CBB: 'Cochabamba',
  // Paraguay & Uruguay
  ASU: 'Asunción', MVD: 'Montevideo',
  // Venezuela
  CCS: 'Caracas', MAR: 'Maracaibo',
  // México
  MEX: 'Ciudad de México', GDL: 'Guadalajara', MTY: 'Monterrey',
  CUN: 'Cancún', TIJ: 'Tijuana', OAX: 'Oaxaca',
  // Centroamérica & Caribe
  PTY: 'Ciudad de Panamá', SAL: 'San Salvador', TGU: 'Tegucigalpa',
  MGA: 'Managua', SJO: 'San José', GUA: 'Ciudad de Guatemala',
  SDQ: 'Santo Domingo', SJU: 'San Juan', HAV: 'La Habana',
  // EE.UU. & Canadá
  MIA: 'Miami', JFK: 'Nueva York', EWR: 'Newark', LGA: 'Nueva York (LaGuardia)',
  LAX: 'Los Ángeles', ORD: 'Chicago', ATL: 'Atlanta', DFW: 'Dallas',
  SFO: 'San Francisco', IAH: 'Houston', BOS: 'Boston', SEA: 'Seattle',
  LAS: 'Las Vegas', MCO: 'Orlando', IAD: 'Washington D.C.', DCA: 'Washington D.C.',
  YYZ: 'Toronto', YVR: 'Vancouver', YUL: 'Montreal', YYC: 'Calgary',
  // Europa
  MAD: 'Madrid', BCN: 'Barcelona', LHR: 'Londres', LGW: 'Londres (Gatwick)',
  CDG: 'París', ORY: 'París (Orly)', FRA: 'Fráncfort', MUC: 'Múnich',
  AMS: 'Ámsterdam', FCO: 'Roma', MXP: 'Milán', LIN: 'Milán (Linate)',
  ZRH: 'Zúrich', GVA: 'Ginebra', BRU: 'Bruselas', VIE: 'Viena',
  CPH: 'Copenhague', OSL: 'Oslo', ARN: 'Estocolmo', HEL: 'Helsinki',
  LIS: 'Lisboa', OPO: 'Oporto', ATH: 'Atenas', IST: 'Estambul',
  SAW: 'Estambul (Sabiha)', LED: 'San Petersburgo', SVO: 'Moscú',
  // Medio Oriente & África
  DXB: 'Dubái', AUH: 'Abu Dabi', DOH: 'Doha', RUH: 'Riad',
  JNB: 'Johannesburgo', CPT: 'Ciudad del Cabo', NBO: 'Nairobi',
  CAI: 'El Cairo', CMN: 'Casablanca',
  // Asia & Pacífico
  SIN: 'Singapur', KUL: 'Kuala Lumpur', BKK: 'Bangkok',
  NRT: 'Tokio', HND: 'Tokio (Haneda)', ICN: 'Seúl', PUS: 'Busan',
  PEK: 'Pekín', PVG: 'Shanghái', CTU: 'Chengdu', HKG: 'Hong Kong',
  CAN: 'Cantón', SZX: 'Shenzhen', XMN: 'Xiamen',
  DEL: 'Nueva Delhi', BOM: 'Bombay', BLR: 'Bangalore', MAA: 'Chennai',
  CGK: 'Yakarta', DPS: 'Bali', SUB: 'Surabaya',
  SYD: 'Sídney', MEL: 'Melbourne', BNE: 'Brisbane', PER: 'Perth',
  AKL: 'Auckland', CHC: 'Christchurch',
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code')?.toUpperCase().replace(/\s/g, '').trim();

  if (!code || code.length < 4) {
    return NextResponse.json({ error: 'Se necesita al menos 4 caracteres' }, { status: 400 });
  }

  const apiKey = process.env.AIRLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'API key no configurada' }, { status: 500 });
  }

  // IATA standard omits leading zeros (IB0124 on ticket → IB124 in DB)
  function stripLeadingZeros(c: string): string {
    const m = c.match(/^([A-Z0-9]{2,3})(0+)(\d+)$/);
    return m ? `${m[1]}${m[3]}` : c;
  }

  const candidates = [code];
  const stripped = stripLeadingZeros(code);
  if (stripped !== code) candidates.push(stripped);

  type RouteRow = {
    flight_iata: string;
    airline_iata: string;
    dep_iata: string;
    arr_iata: string;
    dep_time: string;
    dep_time_utc?: string;
    arr_time: string;
    arr_time_utc?: string;
    duration?: number;
  };

  async function fetchRoute(flightCode: string): Promise<RouteRow | null> {
    const res = await fetch(
      `https://airlabs.co/api/v9/routes?flight_iata=${encodeURIComponent(flightCode)}&api_key=${apiKey}`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return null;
    const json = await res.json() as { response?: RouteRow[] };
    return json.response?.[0] ?? null;
  }

  try {
    let r: RouteRow | null = null;
    for (const candidate of candidates) {
      r = await fetchRoute(candidate);
      if (r) break;
    }

    if (!r) return NextResponse.json({ found: false });

    const airlineName = AIRLINE_NAMES[r.airline_iata] ?? r.airline_iata;
    const depCity = AIRPORT_CITIES[r.dep_iata] ?? r.dep_iata;
    const arrCity = AIRPORT_CITIES[r.arr_iata] ?? r.arr_iata;

    // Detect next-day arrival: compare UTC times if available, else local times
    const depRef = r.dep_time_utc ?? r.dep_time;
    const arrRef = r.arr_time_utc ?? r.arr_time;
    const toMinutes = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };
    const nextDay = arrRef && depRef ? toMinutes(arrRef) < toMinutes(depRef) : false;

    return NextResponse.json({
      found: true,
      flightIata: r.flight_iata,
      airlineIata: r.airline_iata,
      airlineName,
      depIata: r.dep_iata,
      depCity,
      arrIata: r.arr_iata,
      arrCity,
      depTime: r.dep_time,
      arrTime: r.arr_time,
      duration: r.duration,
      nextDay,
    });
  } catch {
    return NextResponse.json({ found: false });
  }
}
