/**
 * CampusVibe Firestore Seed Script
 *
 * Creates realistic demo users, posts, listings, events, messages, and relationships.
 * Idempotent: uses deterministic document IDs; skips documents that already exist.
 *
 * Usage:
 *   cd functions
 *   npx tsx src/seed.ts
 *
 * Requires a Firebase service account key.
 * Download from: Firebase Console → Project Settings → Service Accounts → Generate New Private Key
 * Save as: functions/serviceAccountKey.json
 *
 * Requires firebase-admin (already in functions/package.json).
 */

import * as admin from "firebase-admin";

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

function initFirebase(): admin.app.App {
  if (admin.apps.length > 0) return admin.apps[0]!;

  // Try to load service account key
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const serviceAccount = require("../serviceAccountKey.json");
    return admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } catch {
    console.error("❌ serviceAccountKey.json not found.");
    console.error("");
    console.error("   To download one:");
    console.error("   1. Go to https://console.firebase.google.com/project/campusvibe-001/settings/serviceaccounts/adminsdk");
    console.error("   2. Click 'Generate new private key'");
    console.error("   3. Save the JSON file as: functions/serviceAccountKey.json");
    console.error("   4. Run this script again: npx tsx src/seed.ts");
    console.error("");
    process.exit(1);
  }
}

const app = initFirebase();
const auth = admin.auth(app);
const db = admin.firestore(app);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const now = admin.firestore.Timestamp.now();
const ts = (daysAgo: number) =>
  admin.firestore.Timestamp.fromDate(new Date(Date.now() - daysAgo * 86_400_000));

async function batchSet(
  collection: string,
  docs: Array<{ id: string; data: Record<string, unknown> }>
): Promise<number> {
  const BATCH_SIZE = 500;
  let written = 0;
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = docs.slice(i, i + BATCH_SIZE);
    for (const { id, data } of chunk) {
      const ref = db.collection(collection).doc(id);
      batch.set(ref, { ...data, created_at: data.created_at ?? now }, { merge: true });
    }
    await batch.commit();
    written += chunk.length;
  }
  return written;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

// ---------------------------------------------------------------------------
// Deterministic User IDs (15 students)
// ---------------------------------------------------------------------------

const U = {
  adebayo:    "cv-usr-01-adebayo",
  sarah:      "cv-usr-02-sarah",
  james:      "cv-usr-03-james",
  fatima:     "cv-usr-04-fatima",
  liam:       "cv-usr-05-liam",
  priya:      "cv-usr-06-priya",
  omar:       "cv-usr-07-omar",
  zoe:        "cv-usr-08-zoe",
  daniel:     "cv-usr-09-daniel",
  amara:      "cv-usr-10-amara",
  ethan:      "cv-usr-11-ethan",
  nina:       "cv-usr-12-nina",
  kofi:       "cv-usr-13-kofi",
  maya:       "cv-usr-14-maya",
  carlos:     "cv-usr-15-carlos",
} as const;

const userIds = Object.values(U);

// ---------------------------------------------------------------------------
// 1. USERS + PROFILES
// ---------------------------------------------------------------------------

const USERS: Array<{
  id: string;
  email: string;
  name: string;
  department: string;
  year: string;
  avatar_url: string | null;
  bio: string;
  is_admin: boolean;
  verification_status: "approved";
}> = [
  {
    id: U.adebayo,
    email: "adebayo.okonkwo@uni.edu",
    name: "Adebayo Okonkwo",
    department: "Computer Science",
    year: "4",
    avatar_url: "https://api.dicebear.com/9.x/notionists/svg?seed=Adebayo",
    bio: "Full-stack dev. Building CampusVibe between classes. Fueled by jollof rice and Stack Overflow.",
    is_admin: true,
    verification_status: "approved",
  },
  {
    id: U.sarah,
    email: "sarah.chen@uni.edu",
    name: "Sarah Chen",
    department: "Business",
    year: "3",
    avatar_url: "https://api.dicebear.com/9.x/notionists/svg?seed=Sarah",
    bio: "Entrepreneurship minor. Running the campus flea market Discord. Ask me about dropshipping.",
    is_admin: false,
    verification_status: "approved",
  },
  {
    id: U.james,
    email: "james.mitchell@uni.edu",
    name: "James Mitchell",
    department: "Architecture",
    year: "4",
    avatar_url: "https://api.dicebear.com/9.x/notionists/svg?seed=James",
    bio: "Design student. Sleep is a myth. My Revit model has more hours than my GPA.",
    is_admin: false,
    verification_status: "approved",
  },
  {
    id: U.fatima,
    email: "fatima.al-hassan@uni.edu",
    name: "Fatima Al-Hassan",
    department: "Law",
    year: "2",
    avatar_url: "https://api.dicebear.com/9.x/notionists/svg?seed=Fatima",
    bio: "Pre-law. Moot court champion. I will argue with you about anything, including this bio.",
    is_admin: false,
    verification_status: "approved",
  },
  {
    id: U.liam,
    email: "liam.oconnor@uni.edu",
    name: "Liam O'Connor",
    department: "Engineering",
    year: "3",
    avatar_url: "https://api.dicebear.com/9.x/notionists/svg?seed=Liam",
    bio: "Mechanical engineering. I fix things that aren't broken. Robotics club VP.",
    is_admin: false,
    verification_status: "approved",
  },
  {
    id: U.priya,
    email: "priya.sharma@uni.edu",
    name: "Priya Sharma",
    department: "Medicine",
    year: "2",
    avatar_url: "https://api.dicebear.com/9.x/notionists/svg?seed=Priya",
    bio: "Pre-med, neuroscience track. Anatomy lab at 7 AM builds character (and sleep debt).",
    is_admin: false,
    verification_status: "approved",
  },
  {
    id: U.omar,
    email: "omar.ibrahim@uni.edu",
    name: "Omar Ibrahim",
    department: "Media Studies",
    year: "3",
    avatar_url: "https://api.dicebear.com/9.x/notionists/svg?seed=Omar",
    bio: "Photographer & filmmaker. If I'm not behind a camera, I'm probably editing.",
    is_admin: false,
    verification_status: "approved",
  },
  {
    id: U.zoe,
    email: "zoe.peters@uni.edu",
    name: "Zoe Peters",
    department: "Fashion Design",
    year: "3",
    avatar_url: "https://api.dicebear.com/9.x/notionists/svg?seed=Zoe",
    bio: "Fashion major, sustainable fashion advocate. Thrifting is a lifestyle, not a trend.",
    is_admin: false,
    verification_status: "approved",
  },
  {
    id: U.daniel,
    email: "daniel.kim@uni.edu",
    name: "Daniel Kim",
    department: "Computer Science",
    year: "2",
    avatar_url: "https://api.dicebear.com/9.x/notionists/svg?seed=Daniel",
    bio: "Freshman who thinks he knows everything about AI. Learning humility one segfault at a time.",
    is_admin: false,
    verification_status: "approved",
  },
  {
    id: U.amara,
    email: "amara.johnson@uni.edu",
    name: "Amara Johnson",
    department: "Education",
    year: "4",
    avatar_url: "https://api.dicebear.com/9.x/notionists/svg?seed=Amara",
    bio: "Future teacher. Tutoring center volunteer. I explain things for a living.",
    is_admin: false,
    verification_status: "approved",
  },
  {
    id: U.ethan,
    email: "ethan.williams@uni.edu",
    name: "Ethan Williams",
    department: "Accounting",
    year: "3",
    avatar_url: "https://api.dicebear.com/9.x/notionists/svg?seed=Ethan",
    bio: "Numbers nerd. Campus investment club president. My spreadsheets have spreadsheets.",
    is_admin: false,
    verification_status: "approved",
  },
  {
    id: U.nina,
    email: "nina.garcia@uni.edu",
    name: "Nina Garcia",
    department: "Biology",
    year: "3",
    avatar_url: "https://api.dicebear.com/9.x/notionists/svg?seed=Nina",
    bio: "Ecology research assistant. I can name every tree on campus. Yes, I'm fun at parties.",
    is_admin: false,
    verification_status: "approved",
  },
  {
    id: U.kofi,
    email: "kofi.asante@uni.edu",
    name: "Kofi Asante",
    department: "Music",
    year: "4",
    avatar_url: "https://api.dicebear.com/9.x/notionists/svg?seed=Kofi",
    bio: "Jazz pianist. Campus radio DJ. I'll play at your open mic if you feed me.",
    is_admin: false,
    verification_status: "approved",
  },
  {
    id: U.maya,
    email: "maya.patel@uni.edu",
    name: "Maya Patel",
    department: "Mathematics",
    year: "2",
    avatar_url: "https://api.dicebear.com/9.x/notionists/svg?seed=Maya",
    bio: "Pure math major. Yes, it's useful. No, I won't prove it to you. (I will.)",
    is_admin: false,
    verification_status: "approved",
  },
  {
    id: U.carlos,
    email: "carlos.rodriguez@uni.edu",
    name: "Carlos Rodriguez",
    department: "Sports Science",
    year: "3",
    avatar_url: "https://api.dicebear.com/9.x/notionists/svg?seed=Carlos",
    bio: "Varsity football + track. I run fast and lift heavy. Campus gym is my second home.",
    is_admin: false,
    verification_status: "approved",
  },
];

// ---------------------------------------------------------------------------
// 2. POSTS (realistic campus content, ~80)
// ---------------------------------------------------------------------------

const POSTS: Array<{
  user_id: string;
  content: string;
  daysAgo: number;
  likes: string[];
}> = [
  // Adebayo (CS, 4th year — developer, campus vibe builder)
  { user_id: U.adebayo, content: "Just shipped the new feed algorithm for CampusVibe! Infinite scroll + smart ranking. Try refreshing the feed and let me know what you think.", daysAgo: 0, likes: [U.sarah, U.daniel, U.james, U.priya, U.liam] },
  { user_id: U.adebayo, content: "Pro tip: if your code works on the first try, you haven't tested it enough. Found three bugs in my 'perfect' feed composer today.", daysAgo: 2, likes: [U.daniel, U.liam, U.omar] },
  { user_id: U.adebayo, content: "CampusVibe now supports Google sign-in! No more typing your email every time. Go try it.", daysAgo: 5, likes: [U.sarah, U.fatima, U.zoe, U.nina, U.amara, U.ethan] },
  { user_id: U.adebayo, content: "Late night coding session in the CS lab. If anyone needs me, I'll be here until the coffee runs out.", daysAgo: 8, likes: [U.daniel, U.liam] },
  { user_id: U.adebayo, content: "Just got my student ID verified on CampusVibe. The process is smooth — upload a photo of your student ID and you're set in minutes.", daysAgo: 12, likes: [U.sarah, U.fatima, U.omar] },

  // Sarah (Business, 3rd year — entrepreneur)
  { user_id: U.sarah, content: "Campus flea market this Saturday! Bring your old textbooks, clothes, and gadgets. I've already got 20 vendors signed up.", daysAgo: 0, likes: [U.zoe, U.ethan, U.kofi, U.amara] },
  { user_id: U.sarah, content: "Just got my business plan approved for the entrepreneurship incubator! Three months of mentorship and seed funding. Let's go!", daysAgo: 3, likes: [U.adebayo, U.ethan, U.fatima, U.omar, U.james] },
  { user_id: U.sarah, content: "Does anyone have a used TI-84 they're selling? Need one for my stats class. Will pay fair price.", daysAgo: 7, likes: [U.maya] },
  { user_id: U.sarah, content: "Hot take: networking > GPA for getting jobs. I've gotten more opportunities from campus events than from my transcript.", daysAgo: 10, likes: [U.ethan, U.carlos, U.omar] },
  { user_id: U.sarah, content: "The campus coffee shop has a new matcha latte and it's actually incredible. Highly recommend.", daysAgo: 14, likes: [U.zoe, U.nina, U.kofi, U.priya] },

  // James (Architecture, 4th year)
  { user_id: U.james, content: "Final year project update: designing a sustainable student housing complex. 3 months of work and my model finally stands on its own.", daysAgo: 1, likes: [U.adebayo, U.james, U.omar, U.liam] },
  { user_id: U.james, content: "Does anyone have a spare ruler and exacto knife? Lost mine in the studio. Will trade for coffee.", daysAgo: 4, likes: [U.omar] },
  { user_id: U.james, content: "The architecture building is open until midnight for finals. If you see someone sleeping under a desk, mind your business.", daysAgo: 9, likes: [U.adebayo, U.daniel, U.nina] },
  { user_id: U.james, content: "Just found out our building design competition entry got shortlisted! Presenting next week.", daysAgo: 15, likes: [U.sarah, U.fatima, U.liam, U.amara] },

  // Fatima (Law, 2nd year)
  { user_id: U.fatima, content: "Moot court final is next week and I've been preparing for two months. The opposing team has no idea what's coming.", daysAgo: 0, likes: [U.sarah, U.amara] },
  { user_id: U.fatima, content: "Hot take: the campus food court should have a halal option. It's 2026, this shouldn't be a debate.", daysAgo: 3, likes: [U.omar, U.adebayo, U.sarah, U.nina, U.zoe] },
  { user_id: U.fatima, content: "Studying constitutional law at 2 AM and questioning all my life choices. At least the library has good AC.", daysAgo: 6, likes: [U.james, U.ethan, U.daniel] },
  { user_id: U.fatima, content: "Who else is taking the bar prep seminar next month? We should form a study group.", daysAgo: 11, likes: [U.amara] },

  // Liam (Engineering, 3rd year)
  { user_id: U.liam, content: "Robotics club just won regionals! Our autonomous rover navigated the obstacle course in record time. Months of debugging paid off.", daysAgo: 1, likes: [U.adebayo, U.daniel, U.james, U.kofi, U.carlos] },
  { user_id: U.liam, content: "If anyone needs help with circuits or thermodynamics, I'm tutoring at the engineering help desk this week. Free, no appointment needed.", daysAgo: 5, likes: [U.amara, U.maya, U.priya] },
  { user_id: U.liam, content: "The 3D printer in the makerspace is broken again. Third time this semester. I'm starting a maintenance fund.", daysAgo: 8, likes: [U.adebayo, U.zoe] },
  { user_id: U.liam, content: "Built a coffee-powered study desk for my dorm. It holds my laptop, has a mug warmer, and charges my phone. Best $40 I've spent.", daysAgo: 13, likes: [U.sarah, U.james, U.omar, U.ethan] },

  // Priya (Medicine, 2nd year)
  { user_id: U.priya, content: "Anatomy lab tip: label everything before you start. Trust me, you do NOT want to mix up the brachial and femoral arteries during practicals.", daysAgo: 2, likes: [U.amara, U.nina] },
  { user_id: U.priya, content: "Free CPR training this Saturday at the health sciences building. Open to all students. Certification included.", daysAgo: 4, likes: [U.adebayo, U.sarah, U.fatima, U.carlos, U.zoe] },
  { user_id: U.priya, content: "I just survived my first organic chemistry exam. The curve saved me but my dignity did not survive.", daysAgo: 7, likes: [U.maya, U.daniel, U.nina, U.ethan] },
  { user_id: U.priya, content: "Reminder: sleep is not optional. I know med students love to brag about all-nighters but your brain needs rest. Take care of yourselves.", daysAgo: 12, likes: [U.adebayo, U.sarah, U.zoe, U.amara, U.kofi, U.liam] },

  // Omar (Media Studies, 3rd year)
  { user_id: U.omar, content: "Just finished editing the documentary short about campus sustainability. Premiere at the student center this Friday at 7 PM. Free popcorn!", daysAgo: 0, likes: [U.kofi, U.zoe, U.sarah, U.adebayo, U.nina] },
  { user_id: U.omar, content: "Shooting portraits for the yearbook this week. If you want a good headshot for your LinkedIn, DM me. Free for students.", daysAgo: 3, likes: [U.sarah, U.fatima, U.priya, U.zoe] },
  { user_id: U.omar, content: "Hot take: film photography > digital. There's something about the grain that digital filters just can't replicate.", daysAgo: 8, likes: [U.zoe, U.james] },
  { user_id: U.omar, content: "The campus newspaper is looking for new writers and photographers. No experience needed, just passion. Link in my bio.", daysAgo: 14, likes: [U.amara, U.nina] },

  // Zoe (Fashion Design, 3rd year)
  { user_id: U.zoe, content: "Upcycled an old pair of jeans into a crossbody bag. The campus thrift store is a goldmine if you have vision.", daysAgo: 1, likes: [U.omar, U.sarah, U.nina] },
  { user_id: U.zoe, content: "Fashion club meeting tomorrow! We're planning the spring runway show. All majors welcome — we need models, designers, and backstage crew.", daysAgo: 4, likes: [U.omar, U.fatima, U.kofi, U.amara] },
  { user_id: U.zoe, content: "Just thrifted a vintage leather jacket for $8. The person at the register had no idea what they were selling.", daysAgo: 9, likes: [U.sarah, U.omar, U.carlos] },
  { user_id: U.zoe, content: "Sustainable fashion isn't about being perfect. It's about making better choices. Start with one thrifted piece this month.", daysAgo: 16, likes: [U.nina, U.priya, U.amara, U.fatima] },

  // Daniel (CS, 2nd year)
  { user_id: U.daniel, content: "Just deployed my first web app! It's a study group finder for CS courses. Still buggy but it works. Feedback welcome.", daysAgo: 0, likes: [U.adebayo, U.liam] },
  { user_id: U.daniel, content: "Can someone explain pointers to me? I've read the textbook three times and I'm more confused than when I started.", daysAgo: 2, likes: [U.adebayo] },
  { user_id: U.daniel, content: "CS study group meets every Wednesday at the library, room 204. We cover data structures and algorithms. All levels welcome.", daysAgo: 6, likes: [U.maya, U.adebayo, U.liam] },
  { user_id: U.daniel, content: "Just realized my final project is due in 48 hours and I haven't started the documentation. Classic.", daysAgo: 10, likes: [U.adebayo, U.james, U.nina] },

  // Amara (Education, 4th year)
  { user_id: U.amara, content: "Student teaching update: my 3rd graders just completed their first research project. They chose topics about animals and presented to the class. So proud!", daysAgo: 1, likes: [U.priya, U.sarah, U.kofi] },
  { user_id: U.amara, content: "If you're struggling with any course, the tutoring center has free peer tutoring for every department. No shame in asking for help.", daysAgo: 5, likes: [U.adebayo, U.fatima, U.liam, U.nina, U.maya] },
  { user_id: U.amara, content: "Education majors: the student teaching placement applications for next semester are due in two weeks. Don't procrastinate!", daysAgo: 8, likes: [] },
  { user_id: U.amara, content: "Just finished my thesis on technology integration in elementary classrooms. 47 pages. I'm never writing again.", daysAgo: 13, likes: [U.adebayo, U.daniel, U.sarah, U.fatima] },

  // Ethan (Accounting, 3rd year)
  { user_id: U.ethan, content: "Investment club meeting recap: we discussed portfolio diversification strategies and the current market outlook. Great turnout tonight!", daysAgo: 2, likes: [U.sarah, U.adebayo] },
  { user_id: U.ethan, content: "Tax season reminder: if you had a part-time job last year, you might be owed a refund. The accounting club is doing free tax prep next week.", daysAgo: 6, likes: [U.sarah, U.fatima, U.carlos, U.omar, U.zoe] },
  { user_id: U.ethan, content: "Just passed the first section of the CPA exam! Months of studying finally paid off. One more to go.", daysAgo: 11, likes: [U.sarah, U.adebayo, U.amara, U.daniel] },

  // Nina (Biology, 3rd year)
  { user_id: U.nina, content: "Field trip to the botanical gardens tomorrow for the ecology class. Bringing my camera. The cherry blossoms are in full bloom!", daysAgo: 0, likes: [U.omar, U.zoe, U.priya] },
  { user_id: U.nina, content: "Fun fact: there are over 200 species of trees on campus. I've catalogued 147 so far. Yes, I have a spreadsheet.", daysAgo: 4, likes: [U.adebayo, U.liam, U.omar] },
  { user_id: U.nina, content: "Research lab is looking for volunteers to help with the wetland restoration project this summer. Paid position, great resume builder.", daysAgo: 9, likes: [U.priya, U.carlos, U.maya] },

  // Kofi (Music, 4th year)
  { user_id: U.kofi, content: "Open mic night at the campus café this Friday! Sign up starts at 6 PM, performances at 7. All genres welcome.", daysAgo: 1, likes: [U.omar, U.zoe, U.sarah, U.carlos] },
  { user_id: U.kofi, content: "Just recorded a new jazz track in the music studio. Nothing beats the sound of a live quartet. Coming to campus radio next week.", daysAgo: 5, likes: [U.omar, U.nina] },
  { user_id: U.kofi, content: "Music theory study group forming for the final. If you can read a treble clef, you're overqualified. We need help.", daysAgo: 10, likes: [U.maya, U.daniel] },

  // Maya (Mathematics, 2nd year)
  { user_id: U.maya, content: "Just solved a problem that my professor said was 'probably too hard for undergrads.' Math isn't hard, you just need the right approach.", daysAgo: 2, likes: [U.adebayo, U.daniel] },
  { user_id: U.maya, content: "Free math tutoring at the STEM center every Tuesday and Thursday. I specialize in calculus and linear algebra.", daysAgo: 7, likes: [U.amara, U.daniel, U.liam] },
  { user_id: U.maya, content: "Controversial opinion: math is beautiful. Not useful — beautiful. The proof of the irrationality of sqrt(2) is art.", daysAgo: 12, likes: [U.adebayo, U.nina] },

  // Carlos (Sports Science, 3rd year)
  { user_id: U.carlos, content: "Football team won 3-1 today! I scored two goals. The gym is going to be crowded tomorrow, get there early.", daysAgo: 0, likes: [U.liam, U.ethan, U.kofi, U.omar] },
  { user_id: U.carlos, content: "Track meet this Saturday at the stadium. Come support! Events start at 9 AM. I'm running the 400m and 4x400 relay.", daysAgo: 3, likes: [U.liam, U.omar, U.zoe] },
  { user_id: U.carlos, content: "Gym tip: don't skip leg day. Your knees will thank you in 20 years. I see too many people only doing bench press.", daysAgo: 7, likes: [U.liam, U.priya] },
  { user_id: U.carlos, content: "Looking for a running buddy for morning jogs around campus. 6 AM, 3-5km. I promise I'll slow down for you.", daysAgo: 11, likes: [U.nina, U.zoe] },
];

// ---------------------------------------------------------------------------
// 3. CONFESSIONS
// ---------------------------------------------------------------------------

const CONFESSIONS: Array<{
  user_id: string;
  content: string;
  daysAgo: number;
  likes: string[];
}> = [
  { user_id: U.daniel, content: "I've been eating instant noodles for a week straight because I spent my food budget on a graphics card. No regrets.", daysAgo: 0, likes: [U.adebayo, U.liam, U.carlos, U.ethan] },
  { user_id: U.james, content: "I pretended to understand what my professor was saying in studio critique. I still don't know what 'negative space' means in this context.", daysAgo: 1, likes: [U.zoe, U.omar, U.nina] },
  { user_id: U.fatima, content: "I fell asleep in the library and drooled on my constitutional law textbook. The person across from me took a photo.", daysAgo: 2, likes: [U.sarah, U.amara, U.priya] },
  { user_id: U.ethan, content: "I accidentally sent my budget spreadsheet to the class group chat instead of my study group. Everyone now knows exactly how little I spend on food.", daysAgo: 3, likes: [U.sarah, U.adebayo, U.daniel, U.zoe, U.kofi] },
  { user_id: U.omar, content: "I've been telling people my film is 'almost done' for three months. It's 40% done. Maybe.", daysAgo: 4, likes: [U.james, U.zoe, U.liam] },
  { user_id: U.priya, content: "I study so hard that sometimes I forget to eat. My roommate now sets alarms for me. Thanks, I guess.", daysAgo: 5, likes: [U.amara, U.nina, U.fatima] },
  { user_id: U.liam, content: "I built a robot for my final project and it immediately drove off the table. My professor gave me an A for 'audacity.'", daysAgo: 6, likes: [U.adebayo, U.daniel, U.carlos, U.kofi] },
  { user_id: U.maya, content: "I once proved a theorem in class that the professor said was impossible. He checked my work for 20 minutes before admitting I was right. Best day of my life.", daysAgo: 7, likes: [U.adebayo, U.daniel, U.nina] },
  { user_id: U.kofi, content: "I practiced a song for three weeks and played it perfectly. The one time I recorded it, my neighbor started vacuuming. Murphy's law.", daysAgo: 8, likes: [U.omar, U.zoe, U.carlos] },
  { user_id: U.sarah, content: "I pitched my business idea to a professor and he laughed. Not in a mean way, but I'm still not sure if it was supportive or dismissive.", daysAgo: 9, likes: [U.ethan, U.adebayo, U.fatima] },
];

// ---------------------------------------------------------------------------
// 4. EVENTS
// ---------------------------------------------------------------------------

const EVENTS: Array<{
  user_id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  rsvps: string[];
  daysAgo: number;
}> = [
  {
    user_id: U.adebayo,
    title: "CampusVibe Launch Party",
    description: "Come celebrate the launch of CampusVibe! Meet the team, give feedback, and enjoy free pizza. We'll demo the new features and take feature requests live.",
    date: futureDate(7),
    time: "6:00 PM",
    location: "Student Center, Room 201",
    rsvps: [U.sarah, U.daniel, U.james, U.omar, U.zoe, U.liam],
    daysAgo: 2,
  },
  {
    user_id: U.sarah,
    title: "Campus Flea Market",
    description: "Buy, sell, and trade! Textbooks, clothes, electronics, furniture. Vendor spots still available — DM me to reserve a table.",
    date: futureDate(3),
    time: "10:00 AM - 4:00 PM",
    location: "University Quad",
    rsvps: [U.zoe, U.ethan, U.omar, U.kofi, U.carlos, U.amara, U.nina],
    daysAgo: 5,
  },
  {
    user_id: U.liam,
    title: "Robotics Club: Build Night",
    description: "Bring your Arduino projects or start from scratch. We have spare parts, mentors, and snacks. All skill levels welcome.",
    date: futureDate(5),
    time: "7:00 PM - 10:00 PM",
    location: "Engineering Building, Makerspace",
    rsvps: [U.adebayo, U.daniel, U.james],
    daysAgo: 3,
  },
  {
    user_id: U.kofi,
    title: "Open Mic Night",
    description: "Music, poetry, comedy — anything goes! Sign up at the door. Free coffee for performers. Hosted by Kofi and the Music Club.",
    date: futureDate(2),
    time: "7:00 PM",
    location: "Campus Café",
    rsvps: [U.omar, U.zoe, U.sarah, U.carlos, U.nina],
    daysAgo: 4,
  },
  {
    user_id: U.omar,
    title: "Documentary Premiere: Campus Green",
    description: "A short documentary about sustainability efforts on campus. Followed by a Q&A panel with environmental science professors.",
    date: futureDate(4),
    time: "7:00 PM",
    location: "Student Center Auditorium",
    rsvps: [U.nina, U.zoe, U.sarah, U.priya, U.adebayo],
    daysAgo: 6,
  },
  {
    user_id: U.ethan,
    title: "Investment Club: Market Watch Party",
    description: "Watch the market close together, discuss trends, and learn portfolio basics. Snacks provided. Great for beginners.",
    date: futureDate(6),
    time: "3:30 PM",
    location: "Business Building, Conference Room A",
    rsvps: [U.sarah, U.adebayo],
    daysAgo: 1,
  },
  {
    user_id: U.carlos,
    title: "Inter-Department Football Tournament",
    description: "5-a-side tournament between departments. Teams of 6 (5 + sub). Registration closes Wednesday. Trophy for the winners!",
    date: futureDate(10),
    time: "9:00 AM",
    location: "University Stadium",
    rsvps: [U.liam, U.omar, U.ethan, U.kofi, U.daniel],
    daysAgo: 7,
  },
  {
    user_id: U.fatima,
    title: "Pre-Law Society: Mock Trial Night",
    description: "Watch and participate in a mock trial! Great for anyone interested in law school. Judges from the local court will preside.",
    date: futureDate(8),
    time: "5:00 PM",
    location: "Law Building, Moot Court Room",
    rsvps: [U.amara, U.sarah],
    daysAgo: 3,
  },
];

// ---------------------------------------------------------------------------
// 5. LISTINGS (Marketplace — 40 items)
// ---------------------------------------------------------------------------

const LISTINGS: Array<{
  user_id: string;
  title: string;
  description: string;
  price: string;
  category: "Electronics" | "Textbooks" | "Clothing" | "Other";
  photos: string[];
  daysAgo: number;
}> = [
  // Electronics (14)
  { user_id: U.daniel, title: "MacBook Air M2 (2024)", description: "Selling my MacBook Air M2, 8GB RAM, 256GB SSD. Perfect condition, barely used — got it as a gift but I prefer my Linux machine. Comes with original charger and box.", price: "$650", category: "Electronics", photos: ["https://picsum.photos/seed/macbook-m2/400/400"], daysAgo: 1 },
  { user_id: U.ethan, title: "iPhone 14 Pro Max", description: "Space Black, 256GB, unlocked. Minor scratches on the back (see photos). Battery health 91%. Switching to Android.", price: "$520", category: "Electronics", photos: ["https://picsum.photos/seed/iphone14pro/400/400"], daysAgo: 2 },
  { user_id: U.omar, title: "Sony WH-1000XM5 Headphones", description: "Noise-cancelling headphones in black. Used for one semester. Incredible sound quality. Includes carrying case.", price: "$180", category: "Electronics", photos: ["https://picsum.photos/seed/sonyxm5/400/400"], daysAgo: 3 },
  { user_id: U.liam, title: "Anker PowerCore 20000mAh Power Bank", description: "Dual USB output, fast charging. Used it for one road trip. Works perfectly, just upgraded to a bigger one.", price: "$25", category: "Electronics", photos: ["https://picsum.photos/seed/ankerbank/400/400"], daysAgo: 5 },
  { user_id: U.james, title: "Wacom Intuos Graphics Tablet", description: "Medium size, great for design students. Includes pen and USB cable. Selling because I upgraded to an iPad Pro.", price: "$60", category: "Electronics", photos: ["https://picsum.photos/seed/wacom-intuos/400/400"], daysAgo: 7 },
  { user_id: U.sarah, title: "Samsung 27\" Monitor", description: "1080p, 75Hz, great for studying or gaming. VESA mount compatible. Minor dead pixel in the corner, barely noticeable.", price: "$90", category: "Electronics", photos: ["https://picsum.photos/seed/samsung-monitor/400/400"], daysAgo: 4 },
  { user_id: U.nina, title: "Logitech MX Master 3S Mouse", description: "Best productivity mouse out there. Silent clicks, USB-C charging. Works with Mac and Windows. Selling because I got the new version.", price: "$55", category: "Electronics", photos: ["https://picsum.photos/seed/mxmaster3s/400/400"], daysAgo: 6 },
  { user_id: U.carlos, title: "JBL Flip 6 Bluetooth Speaker", description: "Portable waterproof speaker. Perfect for dorm rooms or outdoor hangouts. Yellow color. Works great, just don't need two.", price: "$65", category: "Electronics", photos: ["https://picsum.photos/seed/jbl-flip6/400/400"], daysAgo: 8 },
  { user_id: U.maya, title: "Texas Instruments TI-84 Plus CE", description: "Graphing calculator in blue. Required for calculus but I'm done with math classes. Includes cover and manual.", price: "$45", category: "Electronics", photos: ["https://picsum.photos/seed/ti84calc/400/400"], daysAgo: 3 },
  { user_id: U.priya, title: "iPad Air 5th Gen + Apple Pencil", description: "64GB, Space Gray. Used for note-taking in lectures. Apple Pencil 2 included. Comes with a Logitech keyboard case.", price: "$380", category: "Electronics", photos: ["https://picsum.photos/seed/ipadair5/400/400"], daysAgo: 10 },
  { user_id: U.kofi, title: "Focusrite Scarlett 2i2 Audio Interface", description: "2nd gen, works perfectly for recording vocals or instruments. Includes USB cable. Upgraded to the 4i4.", price: "$70", category: "Electronics", photos: ["https://picsum.photos/seed/focusrite2i2/400/400"], daysAgo: 5 },
  { user_id: U.adebayo, title: "Raspberry Pi 4 Kit", description: "4GB RAM, comes with case, power supply, SD card, and breadboard. Perfect for CS or engineering projects.", price: "$55", category: "Electronics", photos: ["https://picsum.photos/seed/raspberrypi4/400/400"], daysAgo: 12 },
  { user_id: U.amara, title: "Canon EOS Rebel T7 Camera", description: "DSLR with 18-55mm kit lens. Great for beginners. Includes camera bag, extra battery, and 32GB SD card.", price: "$280", category: "Electronics", photos: ["https://picsum.photos/seed/canonrebel/400/400"], daysAgo: 9 },
  { user_id: U.fatima, title: "Dell UltraSharp 24\" Monitor", description: "USB-C, great for connecting laptops. Anti-glare screen. Used for one semester of remote classes.", price: "$130", category: "Electronics", photos: ["https://picsum.photos/seed/dell-monitor/400/400"], daysAgo: 14 },

  // Textbooks (10)
  { user_id: U.priya, title: "Gray's Anatomy (42nd Edition)", description: "The big one. Heavy, and expensive new. This one has some highlighting but is in great shape.", price: "$40", category: "Textbooks", photos: ["https://picsum.photos/seed/grays-anatomy/400/400"], daysAgo: 2 },
  { user_id: U.daniel, title: "Introduction to Algorithms (CLRS)", description: "The CS bible. 4th edition. Some margin notes from previous owner but very clean overall.", price: "$30", category: "Textbooks", photos: ["https://picsum.photos/seed/algorithms-book/400/400"], daysAgo: 6 },
  { user_id: U.fatima, title: "Constitutional Law Casebook", description: "18th edition, used for Law 201. Some highlighting but no writing. Required for next semester.", price: "$35", category: "Textbooks", photos: ["https://picsum.photos/seed/const-law/400/400"], daysAgo: 4 },
  { user_id: U.maya, title: "Calculus: Early Transcendentals (Stewart)", description: "8th edition. Required for MATH 151-153. A few pages have notes but overall clean.", price: "$25", category: "Textbooks", photos: ["https://picsum.photos/seed/calculus-book/400/400"], daysAgo: 8 },
  { user_id: U.ethan, title: "Financial Accounting (Weygandt)", description: "12th edition. Perfect condition — I bought it but ended up using the PDF version instead.", price: "$20", category: "Textbooks", photos: ["https://picsum.photos/seed/accounting-book/400/400"], daysAgo: 11 },
  { user_id: U.nina, title: "Campbell Biology (12th Edition)", description: "The definitive biology textbook. Heavy but thorough. Some highlighting in chapters 1-10.", price: "$35", category: "Textbooks", photos: ["https://picsum.photos/seed/biology-book/400/400"], daysAgo: 7 },
  { user_id: U.liam, title: "Engineering Mechanics: Statics (Hibbeler)", description: "14th edition. Clean, barely used. I switched to the online version.", price: "$22", category: "Textbooks", photos: ["https://picsum.photos/seed/statics-book/400/400"], daysAgo: 15 },
  { user_id: U.amara, title: "Educational Psychology (Woolfolk)", description: "14th edition. Required for EDUC 301. Some underlining but very usable.", price: "$18", category: "Textbooks", photos: ["https://picsum.photos/seed/ed-psych/400/400"], daysAgo: 9 },
  { user_id: U.kofi, title: "The Jazz Theory Book (Mark Levine)", description: "The best jazz theory resource out there. Some page wear but intact.", price: "$28", category: "Textbooks", photos: ["https://picsum.photos/seed/jazz-theory/400/400"], daysAgo: 13 },
  { user_id: U.sarah, title: "Principles of Marketing (Kotler)", description: "17th edition. Brand new — never opened. Bought the wrong book for my class.", price: "$40", category: "Textbooks", photos: ["https://picsum.photos/seed/marketing-book/400/400"], daysAgo: 5 },

  // Clothing (8)
  { user_id: U.carlos, title: "Nike Mercurial Football Boots", description: "Size 10, used for one season. Studs still in great condition. Black and green colorway.", price: "$40", category: "Clothing", photos: ["https://picsum.photos/seed/nike-boots/400/400"], daysAgo: 1 },
  { user_id: U.zoe, title: "Vintage Denim Jacket", description: "Medium, oversized fit. Thrifted and hand-painted with a floral design on the back. One of a kind.", price: "$30", category: "Clothing", photos: ["https://picsum.photos/seed/denim-jacket/400/400"], daysAgo: 3 },
  { user_id: U.omar, title: "North Face Puffer Jacket", description: "Large, black. Perfect for winter on campus. Worn for two seasons but still looks great.", price: "$55", category: "Clothing", photos: ["https://picsum.photos/seed/northface-puffer/400/400"], daysAgo: 6 },
  { user_id: U.james, title: "Patagonia Fleece Pullover", description: "Medium, gray. Super warm. Selling because I got a new one for my birthday.", price: "$35", category: "Clothing", photos: ["https://picsum.photos/seed/patagonia-fleece/400/400"], daysAgo: 10 },
  { user_id: U.amara, title: "Adidas Ultraboost Sneakers", description: "Size 9, white. Worn maybe 10 times. They're too narrow for my feet. Basically new.", price: "$70", category: "Clothing", photos: ["https://picsum.photos/seed/adidas-ultra/400/400"], daysAgo: 8 },
  { user_id: U.nina, title: "Rain Jacket (Arc'teryx)", description: "Size S, forest green. Used for field research. Waterproof and breathable. Great for hikes.", price: "$90", category: "Clothing", photos: ["https://picsum.photos/seed/arcteryx-rain/400/400"], daysAgo: 12 },
  { user_id: U.adebayo, title: "CampusVibe Hoodie (Limited)", description: "XL, black. Custom CampusVibe merch — only 20 made. Never worn. Collector's item.", price: "$20", category: "Clothing", photos: ["https://picsum.photos/seed/campusvibe-hoodie/400/400"], daysAgo: 0 },
  { user_id: U.ethan, title: "Formal Blazer", description: "Size M, navy blue. Worn once for a presentation. Looks professional.", price: "$25", category: "Clothing", photos: ["https://picsum.photos/seed/navy-blazer/400/400"], daysAgo: 14 },

  // Other (8)
  { user_id: U.james, title: "Gaming Chair (Secretlab Titan)", description: "Black, size R. Used for one year. Super comfortable for long study sessions. Has lumbar support.", price: "$120", category: "Other", photos: ["https://picsum.photos/seed/secretlab-chair/400/400"], daysAgo: 2 },
  { user_id: U.liam, title: "Desk Lamp (BenQ ScreenBar)", description: "Clips to your monitor, provides even lighting without glare. Game-changer for late night studying.", price: "$60", category: "Other", photos: ["https://picsum.photos/seed/benq-screenbar/400/400"], daysAgo: 5 },
  { user_id: U.sarah, title: "Mini Fridge (Midea 1.6 cu ft)", description: "Compact fridge, perfect for dorm rooms. Keeps drinks cold. Selling because I'm graduating.", price: "$40", category: "Other", photos: ["https://picsum.photos/seed/mini-fridge/400/400"], daysAgo: 7 },
  { user_id: U.kofi, title: "Giant Escape 3 Bicycle", description: "Mountain bike, size M. Used for getting around campus. Some scratches but rides perfectly. Includes lock.", price: "$100", category: "Other", photos: ["https://picsum.photos/seed/giant-bike/400/400"], daysAgo: 4 },
  { user_id: U.daniel, title: "Mechanical Keyboard (Keychron K2)", description: "Hot-swappable, Gateron Brown switches, RGB backlight. Great for coding. Includes extra keycaps.", price: "$50", category: "Other", photos: ["https://picsum.photos/seed/keychron-k2/400/400"], daysAgo: 9 },
  { user_id: U.ethan, title: "HP LaserJet Printer", description: "Wireless, duplex printing. Toner still has plenty of life. Selling because the library has better printers.", price: "$45", category: "Other", photos: ["https://picsum.photos/seed/hp-printer/400/400"], daysAgo: 11 },
  { user_id: U.maya, title: "Scientific Calculator (Casio fx-991EX)", description: "ClassWiz, perfect for engineering and math. Used one semester.", price: "$20", category: "Other", photos: ["https://picsum.photos/seed/casio-calc/400/400"], daysAgo: 6 },
  { user_id: U.carlos, title: "Gym Bag (Under Armour)", description: "Large, black. Has a separate shoe compartment. Used for one semester.", price: "$15", category: "Other", photos: ["https://picsum.photos/seed/ua-gymbag/400/400"], daysAgo: 13 },
];

// ---------------------------------------------------------------------------
// 6. FOLLOWS (social graph)
// ---------------------------------------------------------------------------

const FOLLOWS: Array<[string, string]> = [
  // Sarah follows many people (social butterfly)
  [U.sarah, U.adebayo], [U.sarah, U.james], [U.sarah, U.omar], [U.sarah, U.zoe],
  [U.sarah, U.ethan], [U.sarah, U.carlos], [U.sarah, U.kofi],
  // Adebayo follows back close friends
  [U.adebayo, U.sarah], [U.adebayo, U.daniel], [U.adebayo, U.liam], [U.adebayo, U.james],
  // Daniel follows CS people
  [U.daniel, U.adebayo], [U.daniel, U.liam], [U.daniel, U.maya],
  // Liam follows engineering/CS
  [U.liam, U.adebayo], [U.liam, U.daniel], [U.liam, U.james], [U.liam, U.carlos],
  // Fatima follows a diverse group
  [U.fatima, U.sarah], [U.fatima, U.amara], [U.fatima, U.adebayo], [U.fatima, U.fatima],
  // Priya follows health/campus people
  [U.priya, U.amara], [U.priya, U.nina], [U.priya, U.adebayo],
  // Omar follows creative people
  [U.omar, U.zoe], [U.omar, U.kofi], [U.omar, U.sarah], [U.omar, U.nina],
  // Zoe follows fashion/media
  [U.zoe, U.omar], [U.zoe, U.sarah], [U.zoe, U.nina],
  // Amara follows education/campus
  [U.amara, U.sarah], [U.amara, U.priya], [U.amara, U.fatima], [U.amara, U.adebayo],
  // Ethan follows business
  [U.ethan, U.sarah], [U.ethan, U.adebayo],
  // Nina follows nature/people
  [U.nina, U.omar], [U.nina, U.priya], [U.nina, U.zoe], [U.nina, U.adebayo],
  // Kofi follows music/creative
  [U.kofi, U.omar], [U.kofi, U.zoe], [U.kofi, U.sarah],
  // Maya follows CS/math
  [U.maya, U.adebayo], [U.maya, U.daniel], [U.maya, U.liam],
  // Carlos follows sports
  [U.carlos, U.liam], [U.carlos, U.omar], [U.carlos, U.ethan],
  // Reciprocal follows
  [U.james, U.sarah], [U.james, U.omar], [U.james, U.adebayo],
  [U.ethan, U.carlos],
];

// ---------------------------------------------------------------------------
// 7. COMMENTS
// ---------------------------------------------------------------------------

const COMMENTS: Array<{
  postOwner: string;
  postContentSnippet: string;
  user_id: string;
  content: string;
  daysAgo: number;
}> = [
  { postOwner: U.adebayo, postContentSnippet: "shipped the new feed", user_id: U.daniel, content: "This is sick! The infinite scroll feels so smooth. How did you handle the pagination?", daysAgo: 0 },
  { postOwner: U.adebayo, postContentSnippet: "shipped the new feed", user_id: U.sarah, content: "Love it! Can we get a 'trending' tab next?", daysAgo: 0 },
  { postOwner: U.adebayo, postContentSnippet: "shipped the new feed", user_id: U.liam, content: "The smart ranking is actually really good. Campus posts always show up first.", daysAgo: 0 },
  { postOwner: U.sarah, postContentSnippet: "flea market", user_id: U.zoe, content: "I'll bring some upcycled fashion pieces! How many tables are available?", daysAgo: 0 },
  { postOwner: U.sarah, postContentSnippet: "flea market", user_id: U.ethan, content: "I've got some old textbooks to sell. Do I need to register in advance?", daysAgo: 0 },
  { postOwner: U.sarah, postContentSnippet: "flea market", user_id: U.omar, content: "I can take photos for the vendors if they want promotional shots. Free for the community!", daysAgo: 0 },
  { postOwner: U.james, postContentSnippet: "sustainable student housing", user_id: U.adebayo, content: "Would love to see the Revit model! Are you incorporating any smart home tech?", daysAgo: 1 },
  { postOwner: U.james, postContentSnippet: "sustainable student housing", user_id: U.omar, content: "The renders look amazing. You should post them on the architecture page.", daysAgo: 1 },
  { postOwner: U.fatima, postContentSnippet: "moot court final", user_id: U.amara, content: "You've got this! All that prep is going to pay off.", daysAgo: 0 },
  { postOwner: U.fatima, postContentSnippet: "moot court final", user_id: U.sarah, content: "I'll come watch! When is it exactly?", daysAgo: 0 },
  { postOwner: U.liam, postContentSnippet: "won regionals", user_id: U.adebayo, content: "Congrats!! That autonomous navigation was insane. What sensors did you use?", daysAgo: 1 },
  { postOwner: U.liam, postContentSnippet: "won regionals", user_id: U.daniel, content: "Can you share the code? I want to learn ROS for my next project.", daysAgo: 1 },
  { postOwner: U.liam, postContentSnippet: "won regionals", user_id: U.carlos, content: "Let's gooo! Engineering pride!", daysAgo: 1 },
  { postOwner: U.priya, postContentSnippet: "anatomy lab tip", user_id: U.nina, content: "This saved me so many times. Also, color-coding your notes by system helps a lot.", daysAgo: 2 },
  { postOwner: U.omar, postContentSnippet: "documentary short", user_id: U.nina, content: "The sustainability segment was so well done. The interviews with the grounds crew were my favorite part.", daysAgo: 0 },
  { postOwner: U.omar, postContentSnippet: "documentary short", user_id: U.zoe, content: "Free popcorn?? I'm there! What time should I arrive for good seats?", daysAgo: 0 },
  { postOwner: U.zoe, postContentSnippet: "upcycled jeans", user_id: U.sarah, content: "That bag is adorable! Would you make one for sale? I'd pay $20.", daysAgo: 1 },
  { postOwner: U.zoe, postContentSnippet: "upcycled jeans", user_id: U.omar, content: "The stitching is so clean. You're genuinely talented.", daysAgo: 1 },
  { postOwner: U.daniel, postContentSnippet: "deployed my first web app", user_id: U.adebayo, content: "Nice work! Want me to review the code? I can suggest some optimizations.", daysAgo: 0 },
  { postOwner: U.daniel, postContentSnippet: "deployed my first web app", user_id: U.liam, content: "This is really useful! Can you add a feature for study groups in engineering too?", daysAgo: 0 },
  { postOwner: U.amara, postContentSnippet: "student teaching update", user_id: U.priya, content: "This is so wholesome! 3rd graders doing research projects is impressive.", daysAgo: 1 },
  { postOwner: U.amara, postContentSnippet: "student teaching update", user_id: U.fatima, content: "Future teachers like you make all the difference. The kids are lucky to have you.", daysAgo: 1 },
  { postOwner: U.nina, postContentSnippet: "botanical gardens", user_id: U.omar, content: "I'll bring my camera! The cherry blossoms are going to make incredible photos.", daysAgo: 0 },
  { postOwner: U.nina, postContentSnippet: "botanical gardens", user_id: U.zoe, content: "Can I come even if I'm not in the ecology class? I love botanical gardens!", daysAgo: 0 },
  { postOwner: U.kofi, postContentSnippet: "open mic night", user_id: U.omar, content: "I'll be there with my guitar! What's the sign-up process?", daysAgo: 1 },
  { postOwner: U.kofi, postContentSnippet: "open mic night", user_id: U.zoe, content: "Can I do a spoken word piece? I've been working on something.", daysAgo: 1 },
  { postOwner: U.carlos, postContentSnippet: "won 3-1", user_id: U.liam, content: "Two goals! You were on fire today. That second one was a beauty.", daysAgo: 0 },
  { postOwner: U.carlos, postContentSnippet: "won 3-1", user_id: U.ethan, content: "GG! Defense needs some work but the attack was solid.", daysAgo: 0 },
  { postOwner: U.maya, postContentSnippet: "solved a problem", user_id: U.adebayo, content: "What was the problem? I love seeing 'impossible' problems get crushed.", daysAgo: 2 },
  { postOwner: U.maya, postContentSnippet: "solved a problem", user_id: U.daniel, content: "This is why I switched to CS from pure math. You're built different.", daysAgo: 2 },
  { postOwner: U.ethan, postContentSnippet: "passed CPA", user_id: U.sarah, content: "Let's gooo! One more section and you're officially a CPA. Proud of you!", daysAgo: 11 },
  { postOwner: U.ethan, postContentSnippet: "passed CPA", user_id: U.adebayo, content: "The grind pays off. Congrats!", daysAgo: 11 },
];

// ---------------------------------------------------------------------------
// 8. MESSAGES (chat channels + DMs)
// ---------------------------------------------------------------------------

const CHANNELS = [
  { id: "ch-general", name: "General", type: "general" as const, department: null },
  { id: "ch-cs", name: "Computer Science", type: "department" as const, department: "Computer Science" },
  { id: "ch-engineering", name: "Engineering", type: "department" as const, department: "Engineering" },
  { id: "ch-business", name: "Business", type: "department" as const, department: "Business" },
  { id: "ch-law", name: "Law", type: "department" as const, department: "Law" },
  { id: "ch-music", name: "Music", type: "department" as const, department: "Music" },
  { id: "ch-hostel", name: "Hostel Chat", type: "hostel" as const, department: null },
];

const CHANNEL_MESSAGES: Array<{
  channel_id: string;
  user_id: string;
  content: string;
  daysAgo: number;
}> = [
  // General
  { channel_id: "ch-general", user_id: U.adebayo, content: "Hey everyone! Welcome to the general chat. Be nice, have fun.", daysAgo: 30 },
  { channel_id: "ch-general", user_id: U.sarah, content: "Thanks for setting this up! Finally a place to talk to everyone.", daysAgo: 30 },
  { channel_id: "ch-general", user_id: U.omar, content: "Is there a way to share photos here? I took some great shots at the campus event.", daysAgo: 29 },
  { channel_id: "ch-general", user_id: U.zoe, content: "The campus coffee shop has 2-for-1 lattes today!", daysAgo: 7 },
  { channel_id: "ch-general", user_id: U.carlos, content: "Football game at 3 PM today! Come support the team!", daysAgo: 3 },
  { channel_id: "ch-general", user_id: U.nina, content: "The cherry blossoms by the science building are peak bloom right now 🌸", daysAgo: 1 },

  // CS
  { channel_id: "ch-cs", user_id: U.adebayo, content: "Anyone working on the algorithms assignment? I'm stuck on problem 4.", daysAgo: 10 },
  { channel_id: "ch-cs", user_id: U.daniel, content: "I think it's a dynamic programming problem. Start with the subproblem table.", daysAgo: 10 },
  { channel_id: "ch-cs", user_id: U.maya, content: "I can help with the math parts if anyone needs it. The recurrence relation is key.", daysAgo: 10 },
  { channel_id: "ch-cs", user_id: U.adebayo, content: "Thanks Daniel! That worked. The trick is the memoization.", daysAgo: 9 },
  { channel_id: "ch-cs", user_id: U.liam, content: "Quick question: does anyone know if the CS lab is open this weekend?", daysAgo: 5 },
  { channel_id: "ch-cs", user_id: U.daniel, content: "It should be, but check the door — sometimes they lock it for maintenance.", daysAgo: 5 },

  // Engineering
  { channel_id: "ch-engineering", user_id: U.liam, content: "Robotics club meeting moved to Thursday this week!", daysAgo: 8 },
  { channel_id: "ch-engineering", user_id: U.james, content: "Can we use the makerspace for the architecture model too? Need the 3D printer.", daysAgo: 7 },
  { channel_id: "ch-engineering", user_id: U.liam, content: "Sure, just book a time slot on the shared calendar.", daysAgo: 7 },

  // Business
  { channel_id: "ch-business", user_id: U.sarah, content: "Who's going to the entrepreneurship seminar next week?", daysAgo: 4 },
  { channel_id: "ch-business", user_id: U.ethan, content: "I'll be there! The speaker is from a VC firm — good networking opportunity.", daysAgo: 4 },

  // Law
  { channel_id: "ch-law", user_id: U.fatima, content: "Study group for the bar prep seminar? Library, room 305, Saturday at 2 PM.", daysAgo: 6 },
  { channel_id: "ch-law", user_id: U.amara, content: "I'm not a law student but I'll bring snacks and moral support!", daysAgo: 6 },

  // Music
  { channel_id: "ch-music", user_id: U.kofi, content: "Open mic sign-up sheet is live! Link on my profile.", daysAgo: 5 },
  { channel_id: "ch-music", user_id: U.omar, content: "I'll do a short film screening before the performances. 5-minute documentary.", daysAgo: 4 },

  // Hostel
  { channel_id: "ch-hostel", user_id: U.daniel, content: "Anyone have a spare phone charger? Mine died at 3 AM.", daysAgo: 12 },
  { channel_id: "ch-hostel", user_id: U.liam, content: "Come to room 214, I have an extra USB-C.", daysAgo: 12 },
  { channel_id: "ch-hostel", user_id: U.daniel, content: "You're a lifesaver. I owe you one.", daysAgo: 12 },
  { channel_id: "ch-hostel", user_id: U.nina, content: "The laundry room on the 3rd floor has a broken dryer. Use the one on the 1st floor.", daysAgo: 8 },
  { channel_id: "ch-hostel", user_id: U.carlos, content: "Movie night in the common room tonight! Bringing popcorn.", daysAgo: 3 },
];

// DM conversations
const DM_PAIRS: Array<[string, string, Array<{ sender: string; content: string; daysAgo: number }>]> = [
  [U.adebayo, U.sarah, [
    { sender: U.sarah, content: "Hey Adebayo! The CampusVibe feed is looking amazing.", daysAgo: 5 },
    { sender: U.adebayo, content: "Thanks Sarah! Still working on the marketplace search.", daysAgo: 5 },
    { sender: U.sarah, content: "Let me know if you need help testing. I can get feedback from the business club.", daysAgo: 4 },
    { sender: U.adebayo, content: "That would be great actually! I'll send you a test link.", daysAgo: 4 },
    { sender: U.sarah, content: "Also, can you add a 'featured listings' section to the marketplace?", daysAgo: 2 },
    { sender: U.adebayo, content: "Good idea! I'll add it to the roadmap.", daysAgo: 2 },
  ]],
  [U.daniel, U.adebayo, [
    { sender: U.daniel, content: "Hey! Quick question about the Firestore setup — how do you handle the batch writes?", daysAgo: 7 },
    { sender: U.adebayo, content: "I use writeBatch from firebase/firestore. You can do up to 500 operations per batch.", daysAgo: 7 },
    { sender: U.daniel, content: "Oh nice, so it's atomic? Either all succeed or all fail?", daysAgo: 7 },
    { sender: U.adebayo, content: "Exactly. It's great for things like updating a post and its likes at the same time.", daysAgo: 6 },
    { sender: U.daniel, content: "That's way cleaner than what I was doing. Thanks!", daysAgo: 6 },
  ]],
  [U.zoe, U.omar, [
    { sender: U.zoe, content: "Omar! Your documentary was incredible. The sustainability message really came through.", daysAgo: 4 },
    { sender: U.omar, content: "Thank you Zoe! Your upcycled fashion segment was my favorite part honestly.", daysAgo: 4 },
    { sender: U.zoe, content: "We should collab! A fashion + film project about sustainable campus style.", daysAgo: 3 },
    { sender: U.omar, content: "I'm so down. Let's meet this week to brainstorm.", daysAgo: 3 },
    { sender: U.zoe, content: "Tuesday at the campus café? I'll bring my sketchbook.", daysAgo: 2 },
    { sender: U.omar, content: "Perfect. I'll bring my camera. Let's make something cool.", daysAgo: 2 },
  ]],
  [U.liam, U.carlos, [
    { sender: U.carlos, content: "Bro the robot you built is insane. How long did it take?", daysAgo: 6 },
    { sender: U.liam, content: "About 3 months of weekends. The hardest part was the sensor calibration.", daysAgo: 6 },
    { sender: U.carlos, content: "Could you build something for the football team? Like a ball launcher for practice?", daysAgo: 5 },
    { sender: U.liam, content: "That's actually a great idea. Let me look into it.", daysAgo: 5 },
  ]],
  [U.fatima, U.amara, [
    { sender: U.fatima, content: "Amara, I saw your post about tutoring. I need help with my stats class for the law school prerequisites.", daysAgo: 9 },
    { sender: U.amara, content: "Absolutely! I'm free on Tuesdays and Thursdays. The tutoring center or library?", daysAgo: 9 },
    { sender: U.fatima, content: "Library works! Room 204 at 4 PM?", daysAgo: 8 },
    { sender: U.amara, content: "It's a date! I'll bring my stats notes from when I took it.", daysAgo: 8 },
  ]],
  [U.priya, U.nina, [
    { sender: U.priya, content: "Nina! The botanical garden trip sounds amazing. Can non-ecology students come?", daysAgo: 2 },
    { sender: U.nina, content: "Of course! The more the merrier. We're meeting at the biology building at 9 AM.", daysAgo: 2 },
    { sender: U.priya, content: "I'll be there! I've been wanting to get outside more.", daysAgo: 1 },
  ]],
  [U.ethan, U.sarah, [
    { sender: U.ethan, content: "Sarah, the flea market idea is brilliant. I want to set up a table for the investment club.", daysAgo: 6 },
    { sender: U.sarah, content: "Love it! I have 3 tables left. Want one near the entrance?", daysAgo: 6 },
    { sender: U.ethan, content: "Yes please! We're doing financial literacy pamphlets and selling old textbooks.", daysAgo: 5 },
    { sender: U.sarah, content: "Done! I'll put you next to the coffee stand for maximum foot traffic.", daysAgo: 5 },
  ]],
  [U.kofi, U.maya, [
    { sender: U.kofi, content: "Maya, I need help understanding time signatures for my music theory final.", daysAgo: 8 },
    { sender: U.maya, content: "Oh fun! Time signatures are basically fractions. 4/4 means 4 quarter notes per measure.", daysAgo: 8 },
    { sender: U.kofi, content: "That makes so much more sense than my professor's explanation. Can you tutor me?", daysAgo: 7 },
    { sender: U.maya, content: "Sure! Bring your instrument and we can work through it musically.", daysAgo: 7 },
  ]],
];

// ---------------------------------------------------------------------------
// MAIN SEED FUNCTION
// ---------------------------------------------------------------------------

async function seed(): Promise<void> {
  console.log("🌱 Starting CampusVibe seed...\n");

  // --- 1. Create Firebase Auth users + Profiles ---
  console.log("👤 Creating users...");
  for (const u of USERS) {
    try {
      await auth.createUser({
        uid: u.id,
        email: u.email,
        emailVerified: true,
        displayName: u.name,
        photoURL: u.avatar_url,
        password: "CampusVibe2026!",
      });
      console.log(`  ✅ Auth: ${u.name}`);
    } catch (e: any) {
      if (e.code === "auth/uid-already-exists" || e.code === "auth/email-already-exists") {
        console.log(`  ⏭️  Auth exists: ${u.name}`);
      } else {
        console.error(`  ❌ Auth failed: ${u.name} — ${e.message}`);
      }
    }
  }

  const profileDocs = USERS.map((u) => ({
    id: u.id,
    data: {
      id: u.id,
      email: u.email,
      email_domain: u.email.split("@")[1],
      name: u.name,
      department: u.department,
      year: u.year,
      avatar_url: u.avatar_url,
      bio: u.bio,
      is_admin: u.is_admin,
      banned: false,
      verification_status: u.verification_status,
      student_document_type: null,
      notification_preferences: { likes: true, messages: true, new_events: true, popular_confessions: true },
      created_at: ts(60),
    },
  }));
  await batchSet("profiles", profileDocs);
  console.log(`  → ${USERS.length} users + profiles done\n`);

  // --- 2. Posts ---
  console.log("📝 Creating posts...");
  const postIds: string[] = [];
  const postDocs = POSTS.map((p) => {
    const id = `post-${p.user_id}-${p.daysAgo}-${p.content.slice(0, 20).replace(/[^a-z0-9]/gi, "")}`;
    postIds.push(id);
    return {
      id,
      data: {
        user_id: p.user_id,
        content: p.content,
        image_url: null,
        likes: p.likes,
        created_at: ts(p.daysAgo),
      },
    };
  });
  await batchSet("posts", postDocs);
  console.log(`  → ${POSTS.length} posts created\n`);

  // --- 3. Confessions ---
  console.log("🤫 Creating confessions...");
  const confessionIds: string[] = [];
  const confessionDocs = CONFESSIONS.map((c) => {
    const id = `conf-${c.user_id}-${c.daysAgo}-${c.content.slice(0, 20).replace(/[^a-z0-9]/gi, "")}`;
    confessionIds.push(id);
    return {
      id,
      data: {
        user_id: c.user_id,
        content: c.content,
        image_url: null,
        likes: c.likes,
        created_at: ts(c.daysAgo),
      },
    };
  });
  await batchSet("confessions", confessionDocs);
  console.log(`  → ${CONFESSIONS.length} confessions created\n`);

  // --- 4. Events ---
  console.log("📅 Creating events...");
  const eventIds: string[] = [];
  const eventDocs = EVENTS.map((e) => {
    const id = `event-${e.user_id}-${e.title.replace(/[^a-z0-9]/gi, "").slice(0, 20)}`;
    eventIds.push(id);
    return {
      id,
      data: {
        user_id: e.user_id,
        title: e.title,
        description: e.description,
        date: e.date,
        time: e.time,
        location: e.location,
        image_url: null,
        rsvps: e.rsvps,
        created_at: ts(e.daysAgo),
      },
    };
  });
  await batchSet("events", eventDocs);
  console.log(`  → ${EVENTS.length} events created\n`);

  // --- 5. Marketplace Listings ---
  console.log("🛒 Creating marketplace listings...");
  const listingDocs = LISTINGS.map((l) => ({
    id: `listing-${l.user_id}-${l.title.replace(/[^a-z0-9]/gi, "").slice(0, 20)}`,
    data: {
      user_id: l.user_id,
      title: l.title,
      description: l.description,
      price: l.price,
      category: l.category,
      photos: l.photos,
      created_at: ts(l.daysAgo),
    },
  }));
  await batchSet("listings", listingDocs);
  console.log(`  → ${LISTINGS.length} listings created\n`);

  // --- 6. Follows ---
  console.log("🤝 Creating follows...");
  const followDocs: Array<{ id: string; data: Record<string, unknown> }> = [];
  for (const [follower, following] of FOLLOWS) {
    if (follower === following) continue;
    followDocs.push({
      id: `${follower}_${following}`,
      data: { follower_id: follower, following_id: following, created_at: ts(30) },
    });
  }
  await batchSet("follows", followDocs);
  console.log(`  → ${followDocs.length} follows created\n`);

  // --- 7. Comments ---
  console.log("💬 Creating comments...");
  const postIdLookup = new Map<string, string>();
  for (let i = 0; i < POSTS.length; i++) {
    postIdLookup.set(`${POSTS[i].user_id}:${POSTS[i].content.slice(0, 30)}`, postIds[i]);
  }

  const commentDocs = COMMENTS.map((c) => {
    const key = `${c.postOwner}:${c.postContentSnippet}`;
    const postId = postIdLookup.get(key) ?? postIds[0];
    return {
      id: `cmt-${c.user_id}-${c.daysAgo}-${c.content.slice(0, 15).replace(/[^a-z0-9]/gi, "")}`,
      data: { post_id: postId, user_id: c.user_id, content: c.content, created_at: ts(c.daysAgo) },
    };
  });
  await batchSet("comments", commentDocs);
  console.log(`  → ${commentDocs.length} comments created\n`);

  // --- 8. Reactions ---
  console.log("❤️ Creating reactions...");
  const emojis = ["❤️", "👍", "😂", "😮", "🎉"];
  const reactionDocs: Array<{ id: string; data: Record<string, unknown> }> = [];
  for (let i = 0; i < Math.min(20, postIds.length); i++) {
    const postId = postIds[i];
    const reactors = pickN(userIds.filter((uid) => uid !== POSTS[i].user_id), 1 + Math.floor(Math.random() * 4));
    for (const uid of reactors) {
      reactionDocs.push({
        id: `${uid}_${postId}`,
        data: { user_id: uid, post_id: postId, emoji: pick(emojis), created_at: ts(Math.floor(Math.random() * 10)) },
      });
    }
  }
  await batchSet("reactions", reactionDocs);
  console.log(`  → ${reactionDocs.length} reactions created\n`);

  // --- 9. Reposts ---
  console.log("🔄 Creating reposts...");
  const repostDocs: Array<{ id: string; data: Record<string, unknown> }> = [];
  for (let i = 0; i < Math.min(10, postIds.length); i++) {
    const postId = postIds[i];
    const reposters = pickN(userIds.filter((uid) => uid !== POSTS[i].user_id), 1 + Math.floor(Math.random() * 2));
    for (const uid of reposters) {
      repostDocs.push({
        id: `${uid}_${postId}`,
        data: { user_id: uid, post_id: postId, created_at: ts(Math.floor(Math.random() * 10)) },
      });
    }
  }
  await batchSet("reposts", repostDocs);
  console.log(`  → ${repostDocs.length} reposts created\n`);

  // --- 10. Channels + Channel Members ---
  console.log("💬 Creating channels + memberships...");
  const channelDocs: Array<{ id: string; data: Record<string, unknown> }> = [];
  const memberDocs: Array<{ id: string; data: Record<string, unknown> }> = [];

  for (const ch of CHANNELS) {
    channelDocs.push({ id: ch.id, data: { name: ch.name, type: ch.type, department: ch.department, created_at: ts(60) } });

    if (ch.type === "general" || ch.type === "hostel") {
      for (const u of USERS) {
        memberDocs.push({ id: `${ch.id}_${u.id}`, data: { channel_id: ch.id, user_id: u.id } });
      }
    } else if (ch.department) {
      for (const u of USERS) {
        if (u.department === ch.department) {
          memberDocs.push({ id: `${ch.id}_${u.id}`, data: { channel_id: ch.id, user_id: u.id } });
        }
      }
    }
  }

  // DM channels + members
  for (const [user1, user2] of DM_PAIRS) {
    const dmId = `dm-${[user1, user2].sort().join("-")}`;
    channelDocs.push({ id: dmId, data: { name: "DM", type: "dm", department: null, created_at: ts(30) } });
    memberDocs.push({ id: `${dmId}_${user1}`, data: { channel_id: dmId, user_id: user1 } });
    memberDocs.push({ id: `${dmId}_${user2}`, data: { channel_id: dmId, user_id: user2 } });
  }

  await batchSet("channels", channelDocs);
  await batchSet("channel_members", memberDocs);
  console.log(`  → ${channelDocs.length} channels, ${memberDocs.length} memberships created\n`);

  // --- 11. Messages ---
  console.log("📨 Creating messages...");
  const msgDocs: Array<{ id: string; data: Record<string, unknown> }> = [];

  for (const m of CHANNEL_MESSAGES) {
    msgDocs.push({
      id: `msg-ch-${m.channel_id.slice(3)}-${m.daysAgo}-${m.content.slice(0, 10).replace(/[^a-z0-9]/gi, "")}`,
      data: { channel_id: m.channel_id, user_id: m.user_id, content: m.content, created_at: ts(m.daysAgo) },
    });
  }

  for (const [user1, user2, messages] of DM_PAIRS) {
    const dmId = `dm-${[user1, user2].sort().join("-")}`;
    for (const m of messages) {
      msgDocs.push({
        id: `msg-dm-${dmId.slice(3)}-${m.daysAgo}-${m.content.slice(0, 10).replace(/[^a-z0-9]/gi, "")}`,
        data: { channel_id: dmId, user_id: m.sender, content: m.content, created_at: ts(m.daysAgo) },
      });
    }
  }

  await batchSet("messages", msgDocs);
  console.log(`  → ${msgDocs.length} messages created\n`);

  // --- 12. In-App Notifications ---
  console.log("🔔 Creating notifications...");
  const notifDocs: Array<{ id: string; data: Record<string, unknown> }> = [];

  // Like notifications
  for (let i = 0; i < Math.min(15, POSTS.length); i++) {
    const p = POSTS[i];
    const postId = postIds[i];
    for (const liker of p.likes.slice(0, 3)) {
      notifDocs.push({
        id: `notif-like-${liker}-${postId}`,
        data: { user_id: p.user_id, actor_id: liker, type: "like", content_type: "post", content_id: postId, read: Math.random() > 0.4, created_at: ts(p.daysAgo) },
      });
    }
  }

  // Follow notifications
  for (const [follower, following] of FOLLOWS.slice(0, 20)) {
    if (follower === following) continue;
    notifDocs.push({
      id: `notif-follow-${follower}-${following}`,
      data: { user_id: following, actor_id: follower, type: "follow", content_type: "profile", content_id: follower, read: Math.random() > 0.3, created_at: ts(Math.floor(Math.random() * 20)) },
    });
  }

  // Comment notifications
  for (let i = 0; i < Math.min(10, COMMENTS.length); i++) {
    const c = COMMENTS[i];
    const key = `${c.postOwner}:${c.postContentSnippet}`;
    const postId = postIdLookup.get(key) ?? postIds[0];
    notifDocs.push({
      id: `notif-cmt-${c.user_id}-${postId}-${i}`,
      data: { user_id: c.postOwner, actor_id: c.user_id, type: "comment", content_type: "post", content_id: postId, read: Math.random() > 0.5, created_at: ts(c.daysAgo) },
    });
  }

  await batchSet("in_app_notifications", notifDocs);
  console.log(`  → ${notifDocs.length} notifications created\n`);

  // --- Summary ---
  console.log("═══════════════════════════════════════");
  console.log("  ✅ CampusVibe Seed Complete!");
  console.log("═══════════════════════════════════════");
  console.log(`  👤 Users:            ${USERS.length}`);
  console.log(`  📝 Posts:            ${POSTS.length}`);
  console.log(`  🤫 Confessions:      ${CONFESSIONS.length}`);
  console.log(`  📅 Events:           ${EVENTS.length}`);
  console.log(`  🛒 Listings:         ${LISTINGS.length}`);
  console.log(`  🤝 Follows:          ${followDocs.length}`);
  console.log(`  💬 Comments:         ${commentDocs.length}`);
  console.log(`  ❤️  Reactions:        ${reactionDocs.length}`);
  console.log(`  🔄 Reposts:          ${repostDocs.length}`);
  console.log(`  📨 Messages:         ${msgDocs.length}`);
  console.log(`  🔔 Notifications:    ${notifDocs.length}`);
  console.log(`  📢 Channels:         ${channelDocs.length}`);
  console.log("═══════════════════════════════════════\n");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function futureDate(daysFromNow: number): string {
  const d = new Date(Date.now() + daysFromNow * 86_400_000);
  return d.toISOString().split("T")[0];
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  });
