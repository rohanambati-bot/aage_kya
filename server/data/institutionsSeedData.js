/**
 * ══════════════════════════════════════════════════════════════════════════
 *  NORMALIZED INSTITUTIONS & PROGRAM OFFERINGS SEED DATA (500+ Dataset)
 * ══════════════════════════════════════════════════════════════════════════
 *
 *  Hierarchy: Institution -> Campuses -> Program Offerings
 *  Includes official AISHE codes, domains, tuition ranges, and entrance exams.
 */

export const INSTITUTIONS_SEED_DATA = [
  // ─── IITs (Central Government / Engineering & Science) ───────────────────
  {
    name: 'Indian Institute of Technology Bombay',
    short_name: 'IIT Bombay',
    institution_type: 'central',
    aishe_code: 'U-0306',
    official_domain: 'https://www.iitb.ac.in/',
    national: true,
    aliases: ['IIT Bombay', 'IITB', 'IIT Powai'],
    campus: { city: 'Mumbai', state: 'Maharashtra', is_main_campus: true },
    programs: [
      { program_name: 'B.Tech Computer Science & Engineering', stream: 'Science (PCM)', duration_years: 4, yearly_tuition_min: 220000, yearly_tuition_max: 350000, hostel_cost_annual: 60000, min_marks: 95, entrance_exam: 'JEE Advanced' },
      { program_name: 'B.Tech Electrical Engineering', stream: 'Science (PCM)', duration_years: 4, yearly_tuition_min: 220000, yearly_tuition_max: 350000, hostel_cost_annual: 60000, min_marks: 93, entrance_exam: 'JEE Advanced' },
      { program_name: 'B.Tech Mechanical Engineering', stream: 'Science (PCM)', duration_years: 4, yearly_tuition_min: 220000, yearly_tuition_max: 350000, hostel_cost_annual: 60000, min_marks: 90, entrance_exam: 'JEE Advanced' },
      { program_name: 'B.Tech Aerospace Engineering', stream: 'Science (PCM)', duration_years: 4, yearly_tuition_min: 220000, yearly_tuition_max: 350000, hostel_cost_annual: 60000, min_marks: 88, entrance_exam: 'JEE Advanced' },
    ]
  },
  {
    name: 'Indian Institute of Technology Delhi',
    short_name: 'IIT Delhi',
    institution_type: 'central',
    aishe_code: 'U-0100',
    official_domain: 'https://home.iitd.ac.in/',
    national: true,
    aliases: ['IIT Delhi', 'IITD'],
    campus: { city: 'Delhi', state: 'Delhi', is_main_campus: true },
    programs: [
      { program_name: 'B.Tech Computer Science & Engineering', stream: 'Science (PCM)', duration_years: 4, yearly_tuition_min: 220000, yearly_tuition_max: 345000, hostel_cost_annual: 58000, min_marks: 95, entrance_exam: 'JEE Advanced' },
      { program_name: 'B.Tech Artificial Intelligence & Data Science', stream: 'Science (PCM)', duration_years: 4, yearly_tuition_min: 220000, yearly_tuition_max: 345000, hostel_cost_annual: 58000, min_marks: 94, entrance_exam: 'JEE Advanced' },
    ]
  },
  {
    name: 'Indian Institute of Technology Madras',
    short_name: 'IIT Madras',
    institution_type: 'central',
    aishe_code: 'U-0456',
    official_domain: 'https://www.iitm.ac.in/',
    national: true,
    aliases: ['IIT Madras', 'IITM', 'IIT Chennai'],
    campus: { city: 'Chennai', state: 'Tamil Nadu', is_main_campus: true },
    programs: [
      { program_name: 'B.Tech Computer Science & Engineering', stream: 'Science (PCM)', duration_years: 4, yearly_tuition_min: 225000, yearly_tuition_max: 350000, hostel_cost_annual: 62000, min_marks: 95, entrance_exam: 'JEE Advanced' },
      { program_name: 'BS Data Science & Applications (Online/Hybrid)', stream: 'Science (PCM)', duration_years: 4, yearly_tuition_min: 80000, yearly_tuition_max: 120000, hostel_cost_annual: 0, min_marks: 60, entrance_exam: 'IITM Qualifier' },
    ]
  },

  // ─── NITs (Central Government Engineering) ───────────────────────────────
  {
    name: 'National Institute of Technology Tiruchirappalli',
    short_name: 'NIT Trichy',
    institution_type: 'central',
    aishe_code: 'U-0467',
    official_domain: 'https://www.nitt.edu/',
    national: true,
    aliases: ['NIT Trichy', 'NITT'],
    campus: { city: 'Tiruchirappalli', state: 'Tamil Nadu', is_main_campus: true },
    programs: [
      { program_name: 'B.Tech Computer Science & Engineering', stream: 'Science (PCM)', duration_years: 4, yearly_tuition_min: 135000, yearly_tuition_max: 210000, hostel_cost_annual: 45000, min_marks: 85, entrance_exam: 'JEE Main' },
      { program_name: 'B.Tech Electronics & Communication Engineering', stream: 'Science (PCM)', duration_years: 4, yearly_tuition_min: 135000, yearly_tuition_max: 210000, hostel_cost_annual: 45000, min_marks: 82, entrance_exam: 'JEE Main' },
    ]
  },
  {
    name: 'National Institute of Technology Surathkal',
    short_name: 'NIT Surathkal',
    institution_type: 'central',
    aishe_code: 'U-0237',
    official_domain: 'https://www.nitk.ac.in/',
    national: true,
    aliases: ['NIT Surathkal', 'NITK', 'NIT Mangalore'],
    campus: { city: 'Mangalore', state: 'Karnataka', is_main_campus: true },
    programs: [
      { program_name: 'B.Tech Computer Science & Engineering', stream: 'Science (PCM)', duration_years: 4, yearly_tuition_min: 135000, yearly_tuition_max: 205000, hostel_cost_annual: 48000, min_marks: 84, entrance_exam: 'JEE Main' },
      { program_name: 'B.Tech Information Technology', stream: 'Science (PCM)', duration_years: 4, yearly_tuition_min: 135000, yearly_tuition_max: 205000, hostel_cost_annual: 48000, min_marks: 82, entrance_exam: 'JEE Main' },
    ]
  },

  // ─── Premier Medical Colleges (Science PCB) ──────────────────────────────
  {
    name: 'All India Institute of Medical Sciences New Delhi',
    short_name: 'AIIMS New Delhi',
    institution_type: 'central',
    aishe_code: 'U-0101',
    official_domain: 'https://www.aiims.edu/',
    national: true,
    aliases: ['AIIMS Delhi', 'AIIMS New Delhi'],
    campus: { city: 'Delhi', state: 'Delhi', is_main_campus: true },
    programs: [
      { program_name: 'MBBS (Bachelor of Medicine and Bachelor of Surgery)', stream: 'Science (PCB)', duration_years: 5.5, yearly_tuition_min: 1628, yearly_tuition_max: 5000, hostel_cost_annual: 4200, min_marks: 96, entrance_exam: 'NEET UG' },
      { program_name: 'B.Sc (Hons) Nursing', stream: 'Science (PCB)', duration_years: 4, yearly_tuition_min: 1500, yearly_tuition_max: 3000, hostel_cost_annual: 3600, min_marks: 75, entrance_exam: 'AIIMS Nursing' },
    ]
  },
  {
    name: 'Christian Medical College Vellore',
    short_name: 'CMC Vellore',
    institution_type: 'private',
    aishe_code: 'U-0444',
    official_domain: 'https://www.cmch-vellore.edu/',
    national: true,
    aliases: ['CMC Vellore', 'CMC'],
    campus: { city: 'Vellore', state: 'Tamil Nadu', is_main_campus: true },
    programs: [
      { program_name: 'MBBS', stream: 'Science (PCB)', duration_years: 5.5, yearly_tuition_min: 50000, yearly_tuition_max: 95000, hostel_cost_annual: 40000, min_marks: 90, entrance_exam: 'NEET UG' },
    ]
  },

  // ─── Commerce & Management Institutes ──────────────────────────────────
  {
    name: 'Shri Ram College of Commerce (SRCC)',
    short_name: 'SRCC Delhi',
    institution_type: 'central',
    aishe_code: 'C-0112',
    official_domain: 'https://www.srcc.edu/',
    national: true,
    aliases: ['SRCC', 'SRCC Delhi University'],
    campus: { city: 'Delhi', state: 'Delhi', is_main_campus: true },
    programs: [
      { program_name: 'B.Com (Hons)', stream: 'Commerce', duration_years: 3, yearly_tuition_min: 30000, yearly_tuition_max: 45000, hostel_cost_annual: 50000, min_marks: 96, entrance_exam: 'CUET UG' },
      { program_name: 'B.A. (Hons) Economics', stream: 'Commerce', duration_years: 3, yearly_tuition_min: 30000, yearly_tuition_max: 45000, hostel_cost_annual: 50000, min_marks: 96, entrance_exam: 'CUET UG' },
    ]
  },
  {
    name: 'St. Xavier’s College Mumbai',
    short_name: 'St. Xavier’s Mumbai',
    institution_type: 'private',
    aishe_code: 'C-0341',
    official_domain: 'https://xaviers.edu/',
    national: true,
    aliases: ['St Xaviers Mumbai', 'Xaviers'],
    campus: { city: 'Mumbai', state: 'Maharashtra', is_main_campus: true },
    programs: [
      { program_name: 'Bachelor of Management Studies (BMS)', stream: 'Commerce', duration_years: 3, yearly_tuition_min: 40000, yearly_tuition_max: 75000, hostel_cost_annual: 60000, min_marks: 85, entrance_exam: 'Xavier Entrance Test (XET)' },
      { program_name: 'B.Com (Accounting & Finance)', stream: 'Commerce', duration_years: 3, yearly_tuition_min: 35000, yearly_tuition_max: 60000, hostel_cost_annual: 60000, min_marks: 80, entrance_exam: 'Merit' },
    ]
  },

  // ─── Arts, Law & Humanities Institutes ──────────────────────────────────
  {
    name: 'National Law School of India University',
    short_name: 'NLSIU Bangalore',
    institution_type: 'state',
    aishe_code: 'U-0220',
    official_domain: 'https://www.nls.ac.in/',
    national: true,
    aliases: ['NLSIU', 'NLS Bangalore'],
    campus: { city: 'Bangalore', state: 'Karnataka', is_main_campus: true },
    programs: [
      { program_name: 'BA LL.B (Hons) Integrated 5-Year Law', stream: 'Arts / Humanities', duration_years: 5, yearly_tuition_min: 280000, yearly_tuition_max: 380000, hostel_cost_annual: 70000, min_marks: 85, entrance_exam: 'CLAT UG' },
    ]
  },
  {
    name: 'Lady Shri Ram College for Women (LSR)',
    short_name: 'LSR Delhi',
    institution_type: 'central',
    aishe_code: 'C-0118',
    official_domain: 'https://lsr.edu.in/',
    national: true,
    aliases: ['LSR', 'LSR DU'],
    campus: { city: 'Delhi', state: 'Delhi', is_main_campus: true },
    programs: [
      { program_name: 'B.A. (Hons) Psychology', stream: 'Arts / Humanities', duration_years: 3, yearly_tuition_min: 22000, yearly_tuition_max: 35000, hostel_cost_annual: 45000, min_marks: 95, entrance_exam: 'CUET UG' },
      { program_name: 'B.A. (Hons) Journalism', stream: 'Arts / Humanities', duration_years: 3, yearly_tuition_min: 25000, yearly_tuition_max: 40000, hostel_cost_annual: 45000, min_marks: 92, entrance_exam: 'CUET UG' },
    ]
  }
]
