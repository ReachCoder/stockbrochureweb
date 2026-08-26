Brochure Stock Management System

ប្រព័ន្ធគ្រប់គ្រងស្តុក Brochure (ភាសាខ្មែរ) – ប្រើ Firebase Authentication + Firestore

📁 រចនាសម្ព័ន្ធ Project (Project Structure)

brochure-stock/
├── index.html              ← HTML ចម្បង (ស្អាត ងាយអាន)
├── css/
│   └── styles.css          ← CSS ទាំងអស់ (theme, dark mode, components)
├── js/
│   └── app.js              ← JavaScript ទាំងអស់ (Firebase, Auth, Stock, Reports...)
├── assets/
│   ├── logo_NU.png         ← Logo កម្មវិធី (ត្រូវដាក់ឯកសារនេះ)
│   └── icon_stock.png      ← Icon PWA / Favicon (ត្រូវដាក់ឯកសារនេះ)
├── manifest.json           ← PWA manifest
├── sw.js                   ← Service Worker (offline cache)
├── package.json
└── README.md

ហេតុអ្វីបានបំបែករចនាសម្ព័ន្ធ?





ពីមុន: អ្វីៗទាំងអស់ (HTML + CSS + JS) ស្ថិតក្នុង index.html តែមួយ → ពិបាកកែ និងថែទាំ



ឥឡូវ:





កែ Style → បើក css/styles.css តែប៉ុណ្ណោះ



កែ Logic / Firebase / Feature → បើក js/app.js



កែ UI structure → បើក index.html

🚀 របៀបដំណើរការ





ដាក់រូបភាពទៅក្នុង assets/ :





logo_NU.png



icon_stock.png



បើក terminal នៅក្នុង folder brochure-stock រួចរត់:

npx serve .

ឬ

npm start



បើក browser តាម URL ដែល serve បង្ហាញ (ជាធម្មតា http://localhost:3000)

📌 ចំណាំសំខាន់





Firebase Config ស្ថិតនៅក្នុង js/app.js (ផ្នែកដំបូង)



ប្រព័ន្ធប្រើ Firebase Compat SDK (មិនត្រូវការ build tool)



Dark mode, Role (admin/staff), Stock In/Out, Request, Audit Log, Export Excel, Print, Backup JSON នៅតែដដែល



PWA: បន្ទាប់ពី deploy អាច Install ជា App បាន

🔧 ការអភិវឌ្ឍន៍បន្ត (Future Improvements)

បើចង់បំបែក JS បន្ថែមទៀត សម្រាប់ងាយកែជាងនេះ:

js/
├── config.js       ← Firebase config + constants
├── auth.js         ← Login / role / currentUser
├── stock.js        ← Brochure items CRUD + render
├── stockIn.js
├── stockOut.js
├── departments.js
├── reports.js
├── audit.js
├── utils.js        ← escapeHtml, helpers
└── main.js         ← init + event listeners

បច្ចុប្បន្នរក្សា app.js តែមួយដើម្បីឱ្យដំណើរការភ្លាមៗ ដោយមិនត្រូវការ bundler។

License

Private / Internal use.