export const roadmapFeatures = [
  [12,"privacy","Privacy and Consent Centre","Control optional cookies, analytics and personalisation."],
  [13,"reviews","Reviews and Ratings","Capture structured customer feedback after visits."],
  [14,"favourites","Favourites","Save preferred services, stylists and products."],
  [15,"offers","Offers and Promotions","Review promotions and test promotional codes."],
  [16,"wallet","Gift Card Wallet","Keep gift-card references in one customer view."],
  [17,"loyalty","Loyalty Progress","Estimate points and rewards progress."],
  [18,"appointments","Appointment Self-Service","Prepare reschedule and cancellation requests."],
  [19,"inbox","Customer Inbox","Organise booking, order and salon messages."],
  [20,"pwa","Installable App Readiness","Track PWA and offline-readiness checks."],
  [21,"seo","Search Visibility","Preview customer-facing metadata."],
  [22,"analytics","Analytics Transparency","Review optional measurement categories."],
  [23,"performance","Performance Diagnostics","Inspect lightweight browser diagnostics."],
  [24,"responsive","Responsive Experience QA","Track mobile, tablet and desktop checks."],
  [25,"testing","Frontend Quality Centre","Record smoke-test progress."],
  [26,"release","Frontend Release Readiness","Complete final release checks."],
  [27,"salon-discovery","Salon Discovery","Save location and service preferences."],
  [28,"consultation","Digital Consultation","Prepare goals and history before a visit."],
  [29,"inspiration","Inspiration Board","Save hairstyle ideas and notes."],
  [30,"referrals","Customer Referral Hub","Create and copy a referral reference."],
  [31,"feedback","Product Feedback","Submit structured SalonAI product feedback."],
].map(([sprint,id,title,summary]) => ({ sprint,id,title,summary }));

export const roadmapFeatureMap = Object.fromEntries(
  roadmapFeatures.map((feature) => [feature.id, feature])
);
