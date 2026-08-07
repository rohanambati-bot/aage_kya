/**
 * Professional Quiz Question Bank (Part A3)
 * Direct, adult tone. No emoji, no childish framing.
 * Each question maps to explicit weight nudges in the student's interest vector.
 */

export const QUIZ_QUESTIONS = [
  {
    id: 'q_analytical_vs_creative',
    text: 'When facing a problem with no clear solution, do you prefer working through it methodically using data and rules, or exploring several creative, open-ended approaches at once?',
    type: 'yes_no',
    weightMap: {
      yes: { engineering: 0.3, computing: 0.3, pure_science: 0.2, commerce: 0.2 },
      no: { design: 0.3, media: 0.3, performing: 0.2, arts: 0.2 },
    },
  },
  {
    id: 'q_people_vs_independent',
    text: 'Do you thrive in roles that involve heavy interpersonal communication and client management, or do you work best independently on focused technical tasks?',
    type: 'yes_no',
    weightMap: {
      yes: { management: 0.3, medical: 0.2, education: 0.3, hospitality: 0.3, law: 0.2 },
      no: { computing: 0.3, engineering: 0.2, pure_science: 0.3, design: 0.2 },
    },
  },
  {
    id: 'q_risk_tolerance',
    text: 'Would you prefer a stable, highly structured career path with clear progression, or a higher-risk environment such as a startup or early-stage business?',
    type: 'yes_no',
    weightMap: {
      yes: { commerce: 0.3, defence: 0.3, education: 0.2, medical: 0.2 },
      no: { management: 0.3, computing: 0.2, design: 0.3, vocational: 0.1 },
    },
  },
  {
    id: 'q_hands_on_vs_theory',
    text: 'Do you prefer practical, hands-on application and building physical or digital systems, over deep theoretical study and academic research?',
    type: 'yes_no',
    weightMap: {
      yes: { engineering: 0.3, vocational: 0.3, computing: 0.2, design: 0.2 },
      no: { pure_science: 0.3, law: 0.2, arts: 0.3, commerce: 0.2 },
    },
  },
  {
    id: 'q_relocation_readiness',
    text: 'Are you actively willing to relocate to major national education hubs outside your home state if it grants access to higher-tier institutions?',
    type: 'yes_no',
    weightMap: {
      yes: { engineering: 0.2, medical: 0.2, management: 0.2, computing: 0.2 },
      no: { vocational: 0.2, arts: 0.1, education: 0.1 },
    },
  },
  {
    id: 'q_budget_sensitivity',
    text: 'Is minimizing overall tuition and residential costs a primary constraint when evaluating college options?',
    type: 'yes_no',
    weightMap: {
      yes: { vocational: 0.3, pure_science: 0.2, arts: 0.2, commerce: 0.2 },
      no: { management: 0.2, design: 0.2, medical: 0.2, engineering: 0.2 },
    },
  },
  {
    id: 'q_urban_vs_rural',
    text: 'Do you prefer placement in major metropolitan tech and business centres over regional or specialized campus environments?',
    type: 'yes_no',
    weightMap: {
      yes: { computing: 0.3, management: 0.3, commerce: 0.2, design: 0.2 },
      no: { agriculture: 0.4, pure_science: 0.2, defence: 0.2 },
    },
  },
  {
    id: 'q_software_vs_hardware',
    text: 'Would you rather write software, build algorithms, and develop digital applications than work with physical circuits, machinery, or infrastructure?',
    type: 'yes_no',
    weightMap: {
      yes: { computing: 0.4, design: 0.1 },
      no: { engineering: 0.4, architecture: 0.2 },
    },
  },
  {
    id: 'q_clinical_vs_lab',
    text: 'In healthcare or biology, are you drawn to direct patient care and clinical medicine rather than laboratory analysis and biotechnology research?',
    type: 'yes_no',
    weightMap: {
      yes: { medical: 0.4 },
      no: { pure_science: 0.3, agriculture: 0.2 },
    },
  },
  {
    id: 'q_finance_vs_growth',
    text: 'Are you more interested in financial compliance, accounting, and structured auditing than marketing, strategy, and business development?',
    type: 'yes_no',
    weightMap: {
      yes: { commerce: 0.4 },
      no: { management: 0.4, media: 0.1 },
    },
  },
  {
    id: 'q_law_vs_media',
    text: 'When defending a position, do you lean toward formal legal reasoning and regulatory frameworks, or public communication and media engagement?',
    type: 'yes_no',
    weightMap: {
      yes: { law: 0.4, commerce: 0.1 },
      no: { media: 0.4, arts: 0.2 },
    },
  },
  {
    id: 'q_architecture_vs_product',
    text: 'Are you more inspired by designing physical buildings and urban spaces than digital user interfaces or consumer products?',
    type: 'yes_no',
    weightMap: {
      yes: { architecture: 0.4, engineering: 0.1 },
      no: { design: 0.4, computing: 0.1 },
    },
  },
  {
    id: 'q_public_service',
    text: 'Does a career dedicated to national defence, public policy, or civil administration appeal to you more than private corporate employment?',
    type: 'yes_no',
    weightMap: {
      yes: { defence: 0.4, law: 0.2, arts: 0.2 },
      no: { computing: 0.2, management: 0.2, commerce: 0.2 },
    },
  },
]
