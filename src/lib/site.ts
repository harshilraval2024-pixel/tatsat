export const site = {
  name: "Tatsat NRGS",
  tagline: "Potential Power Solutions",
  description:
    "Premium solar panel installation for homes and businesses across India. Expert design, subsidy guidance, and long-term support from Gujarat.",
  url: "https://tatsat-nrgs.vercel.app",
  phoneDisplay: "+91 98250 12345",
  phoneTel: "+919825012345",
  whatsapp: "919825012345",
  email: "hello@tatsatnrgs.com",
  address: {
    line1: "C - 22, Dhanlaxmi Society",
    line2: "Near L & T Circle, New Vip Road, Karelibaug",
    city: "Vadodara",
    state: "Gujarat",
    pin: "390018",
    country: "India",
  },
  hours: "Mon–Sat: 9:00 AM – 7:00 PM IST",
} as const;

export const navLinks = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/services", label: "Services" },
  { href: "/projects", label: "Projects" },
  { href: "/quote", label: "Get Quote" },
  { href: "/contact", label: "Contact" },
] as const;

export const keyStats = [
  { label: "Installations", value: "850+", hint: "Across Gujarat & Western India" },
  { label: "Customer savings", value: "₹12 Cr+", hint: "Lifetime bill reduction tracked" },
  { label: "Years experience", value: "12+", hint: "Design-to-commissioning expertise" },
] as const;

export const serviceCards = [
  {
    title: "Residential solar",
    blurb: "Rooftop systems sized for real consumption patterns and subsidy-ready documentation.",
    href: "/services#residential",
  },
  {
    title: "Commercial & industrial",
    blurb: "Demand-charge reduction, export optimisation, and structured O&M for uptime.",
    href: "/services#commercial",
  },
  {
    title: "Maintenance & health checks",
    blurb: "Thermal scans, string balancing, and inverter firmware hygiene to protect yield.",
    href: "/services#maintenance",
  },
  {
    title: "Consultation & subsidy desk",
    blurb: "Feasibility, DISCOM paperwork, and Gujarat state scheme navigation end-to-end.",
    href: "/services#consultation",
  },
] as const;

export const whyChoose = [
  {
    title: "Affordable, transparent pricing",
    copy: "Itemised BOQs, no surprise add-ons, and financing partners we have vetted on real projects.",
  },
  {
    title: "Expert installation teams",
    copy: "IEC-minded workmanship, cable routing discipline, and safety-first commissioning checklists.",
  },
  {
    title: "Govt subsidy guidance",
    copy: "Portal submissions, net-metering timelines, and Gujarat-specific documentation support.",
  },
  {
    title: "High-efficiency modules",
    copy: "Tier-1 panels with strong low-light performance for India’s hot, dusty rooftops.",
  },
] as const;

export const processSteps = [
  { title: "Consultation", copy: "Load study, shade analysis, and tariff modelling on your actual bills." },
  { title: "Design", copy: "3D layout, structural sign-off, and DISCOM-ready single-line diagrams." },
  { title: "Installation", copy: "Rapid, clean rooftop execution with milestone photos and QA sign-off." },
  { title: "Support", copy: "Monitoring onboarding, annual health checks, and warranty claim assistance." },
] as const;

export const testimonials = [
  {
    quote:
      "Net metering went live in six weeks. Our summer AC bills in Vadodara finally look sane — the team was meticulous.",
    name: "Meera Shah",
    role: "Homeowner, Vadodara",
  },
  {
    quote:
      "They handled our 250 kWp factory roof in Sanand without stopping production weekends. Yield is tracking above promise.",
    name: "Arjun Patel",
    role: "Operations Director, Sanand",
  },
  {
    quote:
      "Subsidy paperwork was the part we dreaded. Tatsat NRGS literally sat with us through the portal and DISCOM visits.",
    name: "Kiran Desai",
    role: "Clinic owner, Ahmedabad",
  },
] as const;

export const servicesDetail = [
  {
    id: "residential",
    title: "Residential solar",
    icon: "home",
    description:
      "Turnkey rooftop systems for apartments, bungalows, and farmhouses with subsidy-ready documentation for Gujarat DISCOMs.",
    benefits: [
      "Right-sized inverter AC ratio for Indian summers",
      "Bird netting and cable management that survives monsoon",
      "Handover pack with warranties, SLD, and O&M schedule",
    ],
  },
  {
    id: "commercial",
    title: "Commercial & industrial solar",
    icon: "building",
    description:
      "Rooftop and elevated structures for factories, warehouses, cold chains, and institutions chasing demand-charge relief.",
    benefits: [
      "Export credit modelling and TOU awareness baked into design",
      "Safety plans aligned to factory shutdown windows",
      "SCADA-ready monitoring integrations",
    ],
  },
  {
    id: "maintenance",
    title: "Operations & maintenance",
    icon: "wrench",
    description:
      "Protect your yield with scheduled visits, thermal imaging, and rapid inverter support across Ahmedabad and nearby districts.",
    benefits: [
      "IV curve tracing on flagged strings",
      "Soiling studies after dust storms",
      "Spare inverter policy for critical sites",
    ],
  },
  {
    id: "consultation",
    title: "Consultation & subsidy desk",
    icon: "doc",
    description:
      "Independent feasibility, tender support, and step-by-step guidance for Gujarat’s rooftop programmes and central schemes.",
    benefits: [
      "Bill disaggregation and future EV load planning",
      "DISCOM application tracking with escalation paths",
      "Vendor-neutral equipment shortlists",
    ],
  },
] as const;

export const projects = [
  {
    title: "Bungalow rooftop — Bodakdev",
    location: "Ahmedabad, Gujarat",
    sizeKw: 10.12,
    image:
      "https://images.unsplash.com/photo-1508514177221-188b1cf16e9d?auto=format&fit=crop&w=1200&q=80",
  },
  {
    title: "Warehouse net-metered array — Changodar",
    location: "Ahmedabad district, Gujarat",
    sizeKw: 180,
    image:
      "https://images.unsplash.com/photo-1497435334941-8c899ee9e8e9?auto=format&fit=crop&w=1200&q=80",
  },
  {
    title: "Farmhouse off-grid hybrid — Kheda",
    location: "Kheda, Gujarat",
    sizeKw: 15.6,
    image:
      "https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=1200&q=80",
  },
  {
    title: "Clinic rooftop — Satellite",
    location: "Ahmedabad, Gujarat",
    sizeKw: 22,
    image:
      "https://images.unsplash.com/photo-1613665813446-82a78c468a1d?auto=format&fit=crop&w=1200&q=80",
  },
  {
    title: "School canopy — Surat",
    location: "Surat, Gujarat",
    sizeKw: 120,
    image:
      "https://images.unsplash.com/photo-1466611653911-95081537e5b7?auto=format&fit=crop&w=1200&q=80",
  },
  {
    title: "IT park carpark solar — Gift City",
    location: "Gandhinagar, Gujarat",
    sizeKw: 640,
    image:
      "https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=1200&q=80",
  },
] as const;
