// Reusable retreat content — branding-free.

export const LEADERSHIP_DAY_PHILOSOPHY = `## The Day at a Glance

This retreat is built around one premise: leadership teams level up fastest when they do hard, candid, creative work together — under a deadline, with a little chaos.

One day. Seven and a half hours. Five working sessions, one team dinner, one evening game. Everything in between is engineered to do three things at once: surface the real challenges holding the company back, practice giving and receiving structured feedback, and ship something tangible together by 3 PM.

## Three Things to Walk Away With

1. **A shared leadership operating system.** Six principles, one common language for how this team gives feedback, sets expectations, and handles failure.
2. **Honest answers to a few questions you've been avoiding.** The Braintrust and Pre-Mortem sessions are designed to surface what isn't getting said in normal cadence.
3. **Working AI prototypes.** By 3 PM, every team will have shipped a real, functional 10× of a company capability — built today, deployable Monday.

## Two Rules for the Day

**Rule 1 — Candor over comfort.** We are not here to be polite. We are here to be useful. Every session is structured so honest feedback is the default, not the exception. If you find yourself softening something to be "professional," say it the harder way first and edit second.

**Rule 2 — Phones in the basket.** There is a basket. Phones live there from 9 AM until 3:45 PM, except during the hackathon when you'll need them for AI tools. Slack will survive without you for six hours.

## The Six Principles

1. **Give all the praise, take all the criticism.** When the team wins, name them. When the team loses, name yourself.
2. **Always over-communicate.** If you think you've said it enough times, say it once more. The cost of repetition is low. The cost of misalignment is high.
3. **Assume positive intent.** Default to charity. Start from "they're trying to do the right thing and we see it differently."
4. **Surround yourself with people smarter than you.** Catmull's rule. Your job is not to be the smartest person in the room; it's to build the room.
5. **Set clear expectations and stick to them.** The plan changes; the standards don't. Be specific about what "done" looks like and refuse to drift.
6. **Seek failure — then institutionalize the lesson.** Train at the edge of capability. After every failure, the question is not "who?" — it's "what do we change?"`;

export const LEADERSHIP_DAY_AGENDA = [
  {
    title: "Coffee, breakfast & kickoff",
    description:
      "First 15 min: fuel up, no formal start. Second 15 min: organizer opens with why we're here, the day's frame, and the two rules. Close with a 30-second-per-person warm-up: name, role, one word for how you're walking into the day.",
    durationMin: 30,
    activityKey: null,
    facilitatorRole: "Organizer",
  },
  {
    title: "Pitch Deck Improv (surprise format)",
    description:
      "Six absurd, fully-built startup decks. Each round: one volunteer pitches cold (3 min), three colleagues play sharks (4 min Q&A), the room votes IN/OUT. Punctures seriousness, builds the lowest-stakes possible feedback rep.",
    durationMin: 75,
    activityKey: "pitch-deck-improv",
    facilitatorRole: "Organizer",
  },
  {
    title: "The Braintrust — structured candor",
    description:
      "Pixar-style. Each leader brings ONE real challenge from the intake form. 90s present, 90s clarify, 5 min feedback (tagged to one of the six principles), 60s presenter closes with what they're taking. Presenter does NOT respond during feedback.",
    durationMin: 75,
    activityKey: null,
    facilitatorRole: "Organizer",
  },
  {
    title: "Working Lunch — Pre-Mortem",
    description:
      "Two passes. Pass 1: 'It's 18 months from now and we're in serious trouble. What happened?' Pass 2: 'It's 18 months from now and we just signed the biggest deal in our history. What did we deliberately do?' Silent write → round-robin share → cluster → dot-vote.",
    durationMin: 60,
    activityKey: null,
    facilitatorRole: "Organizer",
  },
  {
    title: "10× AI Hackathon",
    description:
      "Two-hour build sprint. Teams of 2-3 pick a track that 10×'s a real company capability. The deliverable is a working prototype that does ONE thing end-to-end — not a slide deck. Each team names a Champion whose only job is to cut scope.",
    durationMin: 120,
    activityKey: null,
    facilitatorRole: "Organizer",
  },
  {
    title: "Hackathon demos + awards",
    description:
      "5 min per team: 60s setup, 3 min live demo (Loom backup mandatory), 60s Q&A. Three categories voted on: Most Useful, Most Creative AI Use, Best Demo. Each non-team-member gets one vote per category.",
    durationMin: 45,
    activityKey: null,
    facilitatorRole: "Organizer",
  },
  {
    title: "Closing Round — what we're taking with us",
    description:
      "Three rounds. (1) Each person, 90s: one surprise, one Monday change, one ask of the team. (2) Group agrees on TWO things to stop doing. (3) Group commits to ONE new ritual — named, scheduled, owned. Final word check: same energy word as 9 AM, plus a new word.",
    durationMin: 45,
    activityKey: null,
    facilitatorRole: "Organizer",
  },
  {
    title: "Free time",
    description: "Hotel, gym, walk, nap. Reconvene at dinner.",
    durationMin: 120,
    activityKey: null,
    facilitatorRole: null,
  },
  {
    title: "Team dinner",
    description: "Reserved private room. No agenda. No pitches. One soft norm: sit next to someone you didn't work directly with during the hackathon.",
    durationMin: 90,
    activityKey: null,
    facilitatorRole: null,
  },
  {
    title: "Evening game (optional)",
    description: "Codenames + One Night Ultimate Werewolf rotation. Beverages encouraged. Backup: trivia or skip and head to the bar.",
    durationMin: 60,
    activityKey: null,
    facilitatorRole: null,
  },
];

// The intake form schema. Each section becomes a card on /r/[token].
export const LEADERSHIP_DAY_INTAKE = [
  {
    id: "name",
    label: "Your name",
    kind: "short",
    required: true,
  },
  {
    id: "role",
    label: "Your role",
    kind: "short",
    placeholder: "e.g. CEO, VP Engineering, Head of Commercial",
    required: true,
  },
  {
    id: "tenure",
    label: "Tenure at the company",
    kind: "select",
    options: ["Less than 6 months", "6–12 months", "1–2 years", "2–4 years", "4+ years", "Founder / since inception"],
    required: true,
  },
  {
    id: "energy",
    label: "Energy level right now (1 = depleted, 5 = electric)",
    kind: "likert",
    anchors: ["Depleted", "Electric"],
  },
  {
    id: "morale",
    label: "Morale on the leadership team (1 = fractured, 5 = aligned and humming)",
    kind: "likert",
    anchors: ["Fractured", "Humming"],
  },
  {
    id: "headline",
    label: "In one or two sentences — what's the headline of your last 30 days?",
    kind: "long",
    placeholder: "The thing that's been taking up most of your head space.",
  },
  {
    id: "lencioni_trust",
    label: "I trust my fellow leadership team members enough to be vulnerable about my mistakes and weaknesses.",
    kind: "likert",
    anchors: ["Strongly disagree", "Strongly agree"],
  },
  {
    id: "lencioni_conflict",
    label: "When we disagree, we have productive, candid debate — not artificial harmony, not personal attacks.",
    kind: "likert",
    anchors: ["Strongly disagree", "Strongly agree"],
  },
  {
    id: "lencioni_commitment",
    label: "When a decision is made, everyone leaves the room genuinely committed to it — even those who disagreed.",
    kind: "likert",
    anchors: ["Strongly disagree", "Strongly agree"],
  },
  {
    id: "lencioni_accountability",
    label: "We hold each other accountable to commitments, behaviors, and standards without it being awkward.",
    kind: "likert",
    anchors: ["Strongly disagree", "Strongly agree"],
  },
  {
    id: "lencioni_results",
    label: "The leadership team consistently prioritizes collective company outcomes over individual department wins.",
    kind: "likert",
    anchors: ["Strongly disagree", "Strongly agree"],
  },
  {
    id: "priority_1",
    label: "Top strategic priority for the next 6 months (be specific)",
    kind: "short",
    required: true,
  },
  {
    id: "priority_2",
    label: "Second priority",
    kind: "short",
    required: true,
  },
  {
    id: "priority_3",
    label: "Third priority",
    kind: "short",
    required: true,
  },
  {
    id: "goal_personal",
    label: "If today goes well, you walk out having…",
    kind: "long",
    placeholder: "Examples: 'gotten unstuck on the X decision,' 'understood why Y has been hard,' 'left with a working tool for Z.'",
  },
  {
    id: "goal_team",
    label: "If today goes well, the leadership team walks out having…",
    kind: "long",
    placeholder: "What needs to be true at 4:30 PM for this to have been worth a day?",
  },
  {
    id: "challenge_title",
    label: "Braintrust challenge — working title",
    kind: "short",
    placeholder: "e.g. 'Whether to bring on a US-based COO before December'",
    required: true,
  },
  {
    id: "challenge_context",
    label: "Context — what's the situation? (3-5 sentences)",
    kind: "long",
    required: true,
  },
  {
    id: "challenge_question",
    label: "The specific question you want the room to push on",
    kind: "long",
    placeholder: "The question, not the answer. 'Am I overweighting cost vs speed here?' is good. 'How do I solve this?' is too vague.",
    required: true,
  },
  {
    id: "challenge_tried",
    label: "What have you already tried or considered?",
    kind: "long",
  },
  {
    id: "skills",
    label: "What you bring to a 2-3 person hackathon team (pick all that apply)",
    kind: "multiselect",
    options: [
      "Strategic thinking",
      "Customer / commercial",
      "Engineering / hardware",
      "Software / coding",
      "Product / UX",
      "Data analysis",
      "Operations / process",
      "Finance / modeling",
      "Storytelling / pitch",
      "Field / domain expertise",
      "Project management",
      "Design / visual",
      "AI prompt-craft",
      "Closing / shipping",
      "Asks-the-hard-questions",
    ],
  },
  {
    id: "ai_comfort",
    label: "AI tool comfort (1 = never used them, 5 = build with them weekly)",
    kind: "likert",
    anchors: ["Never used", "Build weekly"],
  },
  {
    id: "ai_tools",
    label: "AI tools you've used and feel comfortable with",
    kind: "short",
    placeholder: "e.g. ChatGPT, Claude, Gemini, Lovable, Cursor, Zapier, Make.com…",
  },
  {
    id: "hard_question",
    label: "The hard question — what is the question you wish this leadership team would seriously tackle, that you keep avoiding?",
    kind: "long",
    placeholder: "No wrong answers. Could be strategic, structural, cultural, financial, personal. Confidential — only the organizer sees this.",
  },
  {
    id: "risk_18mo",
    label: "It's 18 months from now and the company is in serious trouble. What's the most likely reason?",
    kind: "long",
    placeholder: "Specific. 'A recession' is not an answer. 'We hired the wrong COO and lost the field engineering team' is.",
  },
  {
    id: "upside_18mo",
    label: "It's 18 months from now and the company just signed the biggest deal in our history. What did we deliberately do?",
    kind: "long",
    placeholder: "Same standard — specific moves, not vibes.",
  },
  {
    id: "dietary",
    label: "Dietary restrictions or allergies",
    kind: "short",
    placeholder: "Vegetarian, gluten-free, none, etc.",
  },
  {
    id: "anything_else",
    label: "Anything else the organizer should know",
    kind: "long",
  },
];

// Pitch Deck Improv — six fake startups. Each deck is a list of slides.
// Slides are objects with { tag, title, body[], stat[]?, table?, vibeColor }.
// vibeColor sets the deck accent (matches the AssetCool original look but generic).
export type ImprovSlide = {
  tag?: string;
  title: string;
  body?: string[];
  stats?: { num: string; label: string }[];
  table?: { headers: string[]; rows: string[][]; usCol: number };
  team?: { name: string; role: string; bio: string; cred: string }[];
  ask?: { headline: string; sub: string; lines: { amt: string; what: string }[] };
};

export type ImprovDeck = {
  id: string;
  name: string;
  tagline: string;
  themeColor: string;
  themeBg: string;
  slides: ImprovSlide[];
};

export const PITCH_DECK_IMPROV: ImprovDeck[] = [
  {
    id: "meat-mist",
    name: "MEAT MIST™",
    tagline: "Aerosolized luxury meat — why chew when you can mist?",
    themeColor: "#ff6b6b",
    themeBg: "radial-gradient(ellipse at center, #4a0000 0%, #1a0000 70%, #000 100%)",
    slides: [
      {
        tag: "SERIES SEED · FOOD-TECH (TM)",
        title: "MEAT MIST™",
        body: [
          "Aerosolized luxury meat. The future of dining is in the air.",
          "Pitched by Chad MeatVision, Founder & CMVO (Chief Meat Vision Officer)",
        ],
      },
      {
        tag: "SLIDE 02 · THE PROBLEM",
        title: "Chewing is dead.",
        body: [
          "The average American spends 32 minutes a day chewing. That's 195 hours a year. That's a vacation in Tuscany. Wasted. On chewing.",
          "Meanwhile, premium meat costs $42/lb. Has anyone solved both problems? No. Until now.",
        ],
      },
      {
        tag: "SLIDE 03 · THE SOLUTION",
        title: "Meat. As. Mist.",
        body: [
          "MEAT MIST™ is patented luxury meat aerosolized into a fine, savory cloud. Inhale your steak. Vibe with your wagyu.",
          "Powered by AI. Of course it's powered by AI.",
        ],
      },
      {
        tag: "SLIDE 04 · MARKET",
        title: "$1.4 trillion TAM.",
        stats: [
          { num: "8.1B", label: "Mouths on earth" },
          { num: "100%", label: "Eat (or could)" },
          { num: "$1.4T", label: "Annual food spend" },
        ],
        body: [
          "We are unbundling the steakhouse. We are unbundling the chef. We are unbundling the act of eating itself.",
        ],
      },
      {
        tag: "SLIDE 05 · TRACTION",
        title: "We have shipped one (1) prototype.",
        body: [
          "It atomizes a $42 ribeye into approximately 11 minutes of inhalable mist.",
          "Two of three beta testers reported a 'compelling experience.' The third asked for a refund and water.",
        ],
        stats: [
          { num: "47", label: "Waitlist signups" },
          { num: "1", label: "Working prototype" },
          { num: "$0", label: "Revenue (so far)" },
        ],
      },
      {
        tag: "SLIDE 06 · BUSINESS MODEL",
        title: "Subscription. Of course it's subscription.",
        body: [
          "MeatMist+ at $89/month: unlimited mist sessions, four flavor cartridges (Ribeye, Wagyu, Lobster, 'Mystery').",
          "Enterprise tier $499/month: branded cologne edition for executive offices.",
        ],
      },
      {
        tag: "SLIDE 07 · TEAM",
        title: "200 years of combined meat experience.",
        team: [
          { name: "Chad MeatVision", role: "Founder & CMVO", bio: "Former luxury fragrance exec. Pivoted from 'smelling like meat' to 'tasting like meat.'", cred: "Coined the phrase 'umami-pilled'" },
          { name: "Sasha Beef", role: "Chief Mister Officer", bio: "We don't believe in titles. Sasha disagreed. Sasha won.", cred: "PhD in Aerosol Dynamics, U. of Phoenix Online" },
          { name: "Dr. Pat Wagyu", role: "Head of R&D", bio: "Vegetarian. Says it 'helps with objectivity.'", cred: "Two patents pending, both rejected" },
        ],
      },
      {
        tag: "SLIDE 08 · COMPETITION",
        title: "No one is doing what we're doing. For very good reasons.",
        table: {
          headers: ["", "MEAT MIST™", "Steak", "Beyond Meat", "Just Eating Air"],
          rows: [
            ["Requires chewing", "✓ No", "Yes", "Yes", "No"],
            ["Tastes like meat", "✓ Allegedly", "Yes", "Sometimes", "No"],
            ["FDA approval", "✗ Pending", "Yes", "Yes", "N/A"],
            ["AI-powered", "✓ 100%", "No", "No", "No"],
            ["Has a co-founder named Chad", "✓ Yes", "No", "Probably", "No"],
          ],
          usCol: 1,
        },
      },
      {
        tag: "SLIDE 09 · THE ASK",
        title: "$50M",
        ask: {
          headline: "$50M",
          sub: "Seed round. $500M post-money valuation. (yes, a 100x multiple on $0 in revenue. AI premium.)",
          lines: [
            { amt: "$22M", what: "R&D — we're going to need a bigger atomizer" },
            { amt: "$15M", what: "Marketing — Super Bowl ad with a B-list celebrity" },
            { amt: "$8M", what: "Legal — so much legal" },
            { amt: "$5M", what: "Founder yacht — essential for morale" },
          ],
        },
      },
      {
        tag: "SLIDE 10 · CLOSING",
        title: "JOIN US.",
        body: [
          "In ten years, the entire concept of chewing will feel as quaint as writing letters by hand.",
          "Be on the right side of the jaw revolution.",
        ],
      },
    ],
  },
  {
    id: "crybnb",
    name: "CRYBNB",
    tagline: "Vulnerability-as-a-Service — rent a professional crier.",
    themeColor: "#ec4899",
    themeBg: "linear-gradient(135deg, #1a0033 0%, #2d0050 50%, #4a0080 100%)",
    slides: [
      {
        tag: "PRE-SEED · EMOTIONAL TECH",
        title: "CRYBNB",
        body: [
          "Vulnerability-as-a-Service.",
          "Life is hard. Your shoulders are tired. Rent ours.",
          "Pitched by Tilly McSob — crying since 1991.",
        ],
      },
      {
        tag: "SLIDE 02 · THE PROBLEM",
        title: "People are lonely. Crying alone.",
        body: [
          "Therapy is $200/hr and books out 6 weeks. Friends are judgmental. Pets don't validate feelings in language form.",
          "Meanwhile, 87% of people say they would feel better if a stranger just listened and cried with them.",
          "(*we polled three of our friends. they all said yes. n=3 is a sample.)",
        ],
      },
      {
        tag: "SLIDE 03 · THE SOLUTION",
        title: "A marketplace for professional criers.",
        body: [
          "Like Airbnb, but instead of hosting your home, our criers host your tears. Open the app. Pick a vibe. A trained, vetted, emotionally-flexible human comes to your location and cries with you on demand.",
          "Sympathy Cry · Happy Cry · Rage Cry · Existential Dread Cry",
        ],
      },
      {
        tag: "SLIDE 04 · USE CASES",
        title: "For every milestone life throws at you.",
        body: [
          "Wedding Tears Package — 3 criers, professional sob, mascara-resistant tissues. From $499.",
          "The Breakup — a crier who arrives within 90 minutes of the breakup. Brings ice cream.",
          "Performance Reviews — hire a crier to sit next to you. HR will handle you with care for years.",
          "Thanksgiving Premium — crier blames themselves for everything. Heals the family.",
          "On-Call Cry — 3am sob? We dispatch in under 12 minutes. UrgentCare for the soul.",
        ],
      },
      {
        tag: "SLIDE 05 · TAM",
        title: "The $2.1 trillion emotional intimacy gap.",
        stats: [
          { num: "8.1B", label: "Humans on earth" },
          { num: "~100%", label: "Will cry this year" },
          { num: "$2.1T", label: "TAM (we did the math)" },
        ],
        body: [
          "Therapy is too slow. Friends are too biased. CryBnb is the unbundling of emotional labor.",
        ],
      },
      {
        tag: "SLIDE 06 · UNIT ECONOMICS",
        title: "A 35% take rate. Emotion has no marginal cost.",
        stats: [
          { num: "$129", label: "Avg session price" },
          { num: "35%", label: "Platform take" },
          { num: "$83", label: "Crier earnings" },
        ],
      },
      {
        tag: "SLIDE 07 · TRACTION",
        title: "12,000+ tears shed.",
        stats: [
          { num: "847", label: "Active criers" },
          { num: "$84k", label: "MRR" },
          { num: "4.97★", label: "Avg rating" },
          { num: "2,200", label: "Waitlist" },
        ],
        body: [
          "\"I cried for a man named Brad in Brooklyn last Tuesday. He gave me 5 stars. I have never felt more seen.\" — Margie K., Top 0.1% Crier",
        ],
      },
      {
        tag: "SLIDE 08 · TEAM",
        title: "200 years of combined emotional experience.",
        team: [
          { name: "Tilly McSob", role: "Founder & CEO", bio: "Cried at her wedding (good), her funeral rehearsal (concerning), and her last performance review (twice).", cred: "Has cried in 19 countries" },
          { name: "Dax Sniffletree", role: "COO", bio: "Built three marketplaces. Two failed. The third was Etsy and he was an intern.", cred: "Cries every quarter end" },
          { name: "Dr. Verity Tearfield", role: "Chief Science Officer", bio: "PhD in Lacrimology — she made the field up.", cred: "38 papers, 0 reviewed" },
        ],
      },
      {
        tag: "SLIDE 09 · WHY NOW",
        title: "Three converging tailwinds.",
        body: [
          "📉 The Loneliness Pandemic — Surgeon General called it. We monetized it.",
          "📱 The Gig Economy — if they can drive my Uber, they can sob with me.",
          "🤖 The AI Replacement Wave — when bots take your job, you'll need someone real to cry with. Vibes-as-a-moat.",
        ],
      },
      {
        tag: "SLIDE 10 · THE ASK",
        title: "$8M",
        ask: {
          headline: "$8M",
          sub: "Pre-Seed. $120M post-money valuation.",
          lines: [
            { amt: "$3.2M", what: "Crier acquisition (we will cry to recruit them)" },
            { amt: "$2.5M", what: "Marketing — TikToks of strangers crying" },
            { amt: "$1.8M", what: "Engineering — the tear-detection API" },
            { amt: "$0.5M", what: "Tissue partnerships" },
          ],
        },
      },
    ],
  },
  {
    id: "ghost-gym",
    name: "GHOST GYM",
    tagline: "Fitness for the afterlife. Stay swole post-mortem.",
    themeColor: "#a78bfa",
    themeBg: "linear-gradient(180deg, #0a0a1a 0%, #1a1a3a 50%, #2a2a5a 100%)",
    slides: [
      {
        tag: "CONFIDENTIAL · POST-LIFE FITNESS",
        title: "👻 GHOST GYM",
        body: [
          "Fitness for the afterlife.",
          "Why should staying in shape stop just because your heart did?",
          "Founder: Ezra Shroud · Pitch deck v23 · Series A",
        ],
      },
      {
        tag: "SLIDE 02 · THE PROBLEM",
        title: "8 billion ghosts. Zero gyms.",
        stats: [
          { num: "109B", label: "Humans who have ever lived" },
          { num: "100B", label: "Are dead" },
          { num: "0", label: "Have a gym membership" },
        ],
        body: [
          "Every human eventually dies. The current post-life fitness market is $0. This is what we in the industry call 'a generational opportunity.'",
        ],
      },
      {
        tag: "SLIDE 03 · THE SOLUTION",
        title: "A subscription fitness app for the deceased.",
        body: [
          "Pre-load Ghost Gym before you die. After death, our patented EctoPlasmic Sync™ delivers daily workouts directly to your spirit form.",
          "Spirit Squats — tone the soul.",
          "Phantom Cardio — run through walls, for science.",
          "Soul Plank — strengthens your incorporeal core.",
        ],
      },
      {
        tag: "SLIDE 04 · BUSINESS MODEL",
        title: "Pre-pay while you can still hold a credit card.",
        body: [
          "Living Tier: $19/month. Stay limber for the transition.",
          "Pre-Mortem Tier: $499 lifetime. Locks in eternity of fitness.",
          "Family Plan: pre-buy for your loved ones. They'll thank you when the time comes.",
        ],
      },
      {
        tag: "SLIDE 05 · TRACTION",
        title: "Surprisingly, very little churn.",
        stats: [
          { num: "12k", label: "Pre-mortem subscribers" },
          { num: "0", label: "Refund requests post-death" },
          { num: "100%", label: "Customer retention (technically)" },
        ],
      },
      {
        tag: "SLIDE 06 · TEAM",
        title: "The most committed team you've ever met.",
        team: [
          { name: "Ezra Shroud", role: "Founder & CEO", bio: "Briefly clinically dead in 2019. Came back with the idea.", cred: "Has been to the other side. Allegedly." },
          { name: "Marigold Wraith", role: "Head of Product", bio: "Former Peloton. Got tired of customers eventually leaving.", cred: "Believes 'a customer is forever'" },
          { name: "Dr. Karl Phantom", role: "CSO", bio: "Theoretical physicist. Refuses to confirm afterlife exists. Refuses to deny it.", cred: "Schrödinger's employee" },
        ],
      },
      {
        tag: "SLIDE 07 · THE ASK",
        title: "$25M",
        ask: {
          headline: "$25M",
          sub: "Series A. $300M post-money valuation.",
          lines: [
            { amt: "$10M", what: "EctoPlasmic Sync™ R&D — still figuring out the protocol" },
            { amt: "$8M", what: "Customer acquisition (the living kind)" },
            { amt: "$4M", what: "Legal — afterlife jurisdiction is unsettled" },
            { amt: "$3M", what: "Brand partnerships (Ouija Board, Inc. is interested)" },
          ],
        },
      },
    ],
  },
  {
    id: "air-bread",
    name: "AIR BREAD®",
    tagline: "The bread you can't see. 99.7% gross margins.",
    themeColor: "#0ea5e9",
    themeBg: "linear-gradient(180deg, #f0f9ff 0%, #e0f2fe 50%, #bae6fd 100%)",
    slides: [
      {
        tag: "SEED · INVISIBLE GOODS",
        title: "AIR BREAD®",
        body: [
          "Bread made entirely of air.",
          "The most premium baked good in human history. You cannot see it. That is the point.",
          "Founder: Wheat Hollowman · Bread visionary",
        ],
      },
      {
        tag: "SLIDE 02 · THE PROBLEM",
        title: "Bread is too heavy. And too visible.",
        body: [
          "Existing bread weighs an average of 0.4kg per loaf. Carbon-intensive. Logistically problematic.",
          "Worse: it can be seen, which leads to overconsumption.",
          "Modern consumers want the IDEA of bread without the BURDEN of bread.",
        ],
      },
      {
        tag: "SLIDE 03 · THE SOLUTION",
        title: "Bread, but air.",
        body: [
          "AIR BREAD® is patented bread made entirely of certified premium air. Each loaf is weightless, calorie-free, gluten-free, and visually undetectable.",
          "Comes in three SKUs: Sourdough Air, Brioche Air, Multigrain Air. (All are the same product. We respect the consumer's freedom to differentiate.)",
        ],
      },
      {
        tag: "SLIDE 04 · UNIT ECONOMICS",
        title: "99.7% gross margins.",
        stats: [
          { num: "$0.003", label: "COGS per loaf" },
          { num: "$12.99", label: "Retail price" },
          { num: "99.7%", label: "Gross margin" },
        ],
        body: [
          "The 0.3% is packaging — a recyclable artisan paper bag with the AIR BREAD® logo. The bag is real. The bread is air.",
        ],
      },
      {
        tag: "SLIDE 05 · COMPETITION",
        title: "We beat sourdough on every axis.",
        table: {
          headers: ["", "AIR BREAD®", "Sourdough", "Wonder Bread"],
          rows: [
            ["Calories", "0", "260", "210"],
            ["Gluten", "None", "Yes", "Yes"],
            ["Visible", "✗ No", "Yes", "Yes"],
            ["Spoils", "Never", "5 days", "14 days"],
            ["Presence in your home", "Implied", "Physical", "Physical"],
          ],
          usCol: 1,
        },
      },
      {
        tag: "SLIDE 06 · TRACTION",
        title: "Whole Foods is interested. Allegedly.",
        body: [
          "We had a meeting. They asked to see the product. We pointed to a tray. They nodded politely. We are still confident.",
        ],
        stats: [
          { num: "1", label: "Whole Foods meeting" },
          { num: "0", label: "Confirmed purchase orders" },
          { num: "847", label: "Newsletter signups" },
        ],
      },
      {
        tag: "SLIDE 07 · TEAM",
        title: "Bread visionaries.",
        team: [
          { name: "Wheat Hollowman", role: "Founder & CEO", bio: "Former marketing exec at La Brea Bakery. Realized the bread itself was the inefficiency.", cred: "Trademarked the phrase 'air-pilled'" },
          { name: "Aria Lightcrust", role: "Head of Product", bio: "PhD in Conceptual Cuisine, Brown.", cred: "Wrote dissertation on 'gastronomic absence'" },
        ],
      },
      {
        tag: "SLIDE 08 · THE ASK",
        title: "$15M",
        ask: {
          headline: "$15M",
          sub: "Seed extension. $200M post-money valuation. (premium for the IP.)",
          lines: [
            { amt: "$6M", what: "Brand partnerships — we are in talks with a major airline" },
            { amt: "$4M", what: "Packaging R&D — the bag is the product" },
            { amt: "$3M", what: "Legal — we are anticipating challenges" },
            { amt: "$2M", what: "Working capital — air is technically free but we will need lawyers" },
          ],
        },
      },
    ],
  },
  {
    id: "smellcloud",
    name: "SMELLCLOUD",
    tagline: "Cloud storage for smells. Save grandma's hugs forever.",
    themeColor: "#22c55e",
    themeBg: "linear-gradient(180deg, #052e16 0%, #14532d 50%, #166534 100%)",
    slides: [
      {
        tag: "SEED · OLFACTORY TECH",
        title: "SMELLCLOUD",
        body: [
          "Cloud storage for smells.",
          "Save grandma's hugs. Save your wedding day. Save the bakery on Sunday morning.",
          "Founder: Margot Whiff · Olfactory entrepreneur",
        ],
      },
      {
        tag: "SLIDE 02 · THE PROBLEM",
        title: "Smells are dying every day.",
        body: [
          "The average human encounters 600 distinct smells per day. Almost all of them are lost — forever — within minutes.",
          "Memory fades. Photographs preserve sight. Recordings preserve sound. NOTHING preserves smell.",
          "Until now.",
        ],
      },
      {
        tag: "SLIDE 03 · THE SOLUTION",
        title: "A proprietary Aroma Compression Algorithm.",
        body: [
          "Open the SmellCloud app. Press capture. Our patented OdorSync™ device samples the molecular profile, encodes it via our Aroma Compression Algorithm (ACA), and stores it in the cloud.",
          "Replay the smell anytime via the SmellCloud Diffuser™ ($299, sold separately).",
        ],
      },
      {
        tag: "SLIDE 04 · USE CASES",
        title: "Every memory has a smell.",
        body: [
          "👵 Grandma's Sunday Roast — the smell most people regret losing.",
          "💍 Wedding Day Bouquet — relive the smell on every anniversary.",
          "🍞 The Bakery on the Corner That Closed — preserved before the building was demolished.",
          "🏖️ The Ocean From Your 2019 Trip — when you really needed it.",
          "🐕 Your Dog (Premium Tier) — for after.",
        ],
      },
      {
        tag: "SLIDE 05 · MARKET",
        title: "$340B nostalgia market.",
        stats: [
          { num: "8.1B", label: "Humans with noses" },
          { num: "47", label: "Avg meaningful smells per person" },
          { num: "$340B", label: "TAM (nostalgia + therapy + perfume)" },
        ],
      },
      {
        tag: "SLIDE 06 · TRACTION",
        title: "We have stored 12,000 smells.",
        stats: [
          { num: "12k", label: "Smells stored" },
          { num: "847", label: "Beta users" },
          { num: "$24k", label: "MRR" },
          { num: "23%", label: "MoM growth" },
        ],
        body: [
          "\"I cried when I smelled my late wife's perfume from our 1987 honeymoon. Then I cried again because the smell faded after 12 minutes.\" — Beta tester, 5 stars",
        ],
      },
      {
        tag: "SLIDE 07 · ROADMAP",
        title: "The smell-merge feature is coming.",
        body: [
          "Q3 — SmellCloud Diffuser 2.0 (smaller, more accurate)",
          "Q4 — SmellMerge™: blend two smells into a third (e.g. grandma's roast + ocean = nostalgic vacation)",
          "Q1 — Enterprise tier (museum partnerships, dementia care, real-estate staging)",
          "Q2 — Smell-to-text API (the breakthrough we are most excited about)",
        ],
      },
      {
        tag: "SLIDE 08 · TEAM",
        title: "An eclectic crew.",
        team: [
          { name: "Margot Whiff", role: "Founder & CEO", bio: "Former perfumer. Cried in a market in Marrakech in 2017 and dedicated her life to this.", cred: "Identifies 247 distinct cinnamons" },
          { name: "Theo Olfactus", role: "CTO", bio: "Dropped out of MIT. Built three startups. None about smell. Until now.", cred: "Made olfactory the first AI vertical" },
          { name: "Pierre Nasale", role: "Chief Smell Officer", bio: "Trained in France. Speaks of scent in a way that makes most people uncomfortable.", cred: "Won the 2019 European Nose Off" },
        ],
      },
      {
        tag: "SLIDE 09 · THE ASK",
        title: "$12M",
        ask: {
          headline: "$12M",
          sub: "Seed. $180M post-money valuation.",
          lines: [
            { amt: "$5M", what: "ACA v2 — the compression is currently lossy after 90 days" },
            { amt: "$3M", what: "Hardware (the Diffuser is too expensive to manufacture)" },
            { amt: "$2.5M", what: "Marketing — we need a flagship Sephora pilot" },
            { amt: "$1.5M", what: "Pierre's salary (non-negotiable)" },
          ],
        },
      },
    ],
  },
  {
    id: "blinkchain",
    name: "BLINKCHAIN",
    tagline: "NFTs minted on the eyelid blockchain. Every blink is an asset.",
    themeColor: "#a855f7",
    themeBg: "linear-gradient(135deg, #1a0033 0%, #2d0050 50%, #4a0080 100%)",
    slides: [
      {
        tag: "PRE-A · OCULAR FINANCE",
        title: "BLINKCHAIN",
        body: [
          "NFTs minted on the eyelid blockchain.",
          "Every blink is an asset. Every wink is a transaction.",
          "Founder: Lex Pupillon · early in NFTs (left in '23) · early in DeFi (left in '24) · now early in ocular.",
        ],
      },
      {
        tag: "SLIDE 02 · THE PROBLEM",
        title: "Your blinks are unmonetized.",
        body: [
          "The average human blinks 28,000 times per day. That's 10.2 million times per year.",
          "Currently, you earn $0 per blink. Web2 capitalism has stolen your eyelid labor.",
          "In Web3, your blinks belong to you, the network, and a small Cayman LLC we set up.",
        ],
      },
      {
        tag: "SLIDE 03 · THE SOLUTION",
        title: "A blockchain. For your blinks.",
        body: [
          "Strap on the BlinkCap™. Every eyelid closure is captured by our patented Ocular Oracle, hashed on-chain via zk-SNARKs, and minted as a unique non-fungible $BLINK token.",
          "Trade them. Stake them. Use them as collateral. Form blink DAOs. Vibe.",
        ],
      },
      {
        tag: "SLIDE 04 · TOKENOMICS",
        title: "$BLINK distribution.",
        body: [
          "40% — Public mint (the blinkers)",
          "25% — Founder allocation (vested 50 years)",
          "15% — Treasury (also founder, basically)",
          "10% — Strategic partners (people we owe favors)",
          "5% — Liquidity pool (vibes)",
          "5% — Eye burned (deflationary)",
          "All math has been peer-reviewed by Discord.",
        ],
      },
      {
        tag: "SLIDE 05 · MARKET",
        title: "$82 quadrillion opportunity.",
        body: [
          "(8B people × 28k blinks/day × 365 days × 70 years × $0.001 per blink at maturity)",
          "Anyone who tells you this market doesn't exist probably blinks for free.",
        ],
      },
      {
        tag: "SLIDE 06 · UTILITY",
        title: "Real utility. We mean it this time.",
        body: [
          "👁️ Blink-to-Earn — just stay alive. Earn $BLINK passively.",
          "🤝 Blink Lending — borrow against future blinks. 14% APY.",
          "🎨 Rare Blinks — surprised blinks higher rarity. Sneezes mint 5×. Crying = legendary.",
          "🏛 Blink DAO — vote on protocol changes. 1 blink = 1 vote. 1 wink = 2.",
        ],
      },
      {
        tag: "SLIDE 07 · TRACTION",
        title: "2.3 billion blinks minted.",
        stats: [
          { num: "2.3B", label: "Blinks minted" },
          { num: "14k", label: "Active holders" },
          { num: "$0.0003", label: "Floor price" },
          { num: "87k", label: "Discord members" },
        ],
      },
      {
        tag: "SLIDE 08 · TEAM",
        title: "200 years combined experience. Most pseudonymous.",
        team: [
          { name: "Lex Pupillon", role: "Founder & CEO", bio: "Was early in NFTs (left in '23, lost $4M). Was early in DeFi (left in '24, lost $7M).", cred: "Forbes 30 Under 30 (year not specified)" },
          { name: "Anon0xC0deM4ster", role: "CTO", bio: "Pseudonymous. Has built three projects. Two have rug-pulled. He says it wasn't him.", cred: "Audited by his cousin" },
          { name: "Trillian \"Vibes\" Goblin", role: "Head of Community", bio: "Posts memes 19 hours/day. Has been deplatformed from Twitter, Discord, and her family group chat.", cred: "'gm' every day since 2019" },
        ],
      },
      {
        tag: "SLIDE 09 · THE ASK",
        title: "$40M",
        ask: {
          headline: "$40M",
          sub: "Pre-Series A. $1.4B fully diluted token valuation. (B for billion. on $0 revenue. it's a token thing.)",
          lines: [
            { amt: "$15M", what: "BlinkCap™ hardware development" },
            { amt: "$10M", what: "Community marketing — paid TikTok" },
            { amt: "$8M", what: "Token treasury / market making" },
            { amt: "$7M", what: "Legal — SEC outcomes pending" },
          ],
        },
      },
    ],
  },
];
