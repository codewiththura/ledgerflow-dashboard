# LedgerFlow

A professional, real-time financial performance and ledger dashboard designed to manage sales, expenses, and inventory metrics cleanly. Built on a modern tech stack featuring **Next.js**, **TypeScript**, and **Firebase (Auth & Firestore)**.

> [!WARNING]
> **Production Readiness & Use Disclaimer**
> 
> This application is currently configured and optimized for **personal/private use** (e.g., small business tracking or individual ledger management).
> 
> **Before deploying this application to a production environment, you MUST double-test and audit it.** Key items to address:
> 1. **Firebase Security Rules**: Ensure that your Firestore Security Rules strictly validate read/write access based on user session authentication and profiles (e.g., restricting administrative database writes and respecting the `shared` visibility flag).
> 2. **Authentication Flow**: Enforce strict session validations and secure token handling.
> 3. **API Access Control**: Configure API key restrictions in the Google Cloud / Firebase console to limit requests only from your authorized production domain.

---

## Key Features

- **Performance Analytics**: Visualizes Net Revenue, Total Sales, Total Expenses, and Active Customer Counts over custom or preset periods (Week, Month, Year).
- **Interactive Revenue Trends**: Powered by dynamic Recharts showing comparative daily sales against operational expenses.
- **Granular Visibility Controls**: Supports privacy flags (`Shared` vs `Only Me`) for sales and expenses records to manage team-wide vs personal view rights.
- **Role-Based Views**: Configured with user profiles (e.g., Admin vs User roles) determining data scope.
- **Inventory & Transaction Records**: Itemized sales registration, transaction tracking (supporting payment services like KPay / Aya), and customer purchase history.
- **Optimized UI Components**: Integrated custom, reusable confirmation dialogs, validation labels, and firestore-backed cursor pagination controls.

---

## Technical Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router, Turbopack enabled)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Database & Auth**: [Firebase](https://firebase.google.com/) (Auth & Firestore)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Component Library**: [Radix UI](https://www.radix-ui.com/) & [shadcn/ui](https://ui.shadcn.com/)
- **Charts**: [Recharts](https://recharts.org/)
- **Icons**: [Lucide React](https://lucide.dev/)

---

## Getting Started

### 1. Environment Setup

Copy `.env.example` to create a local environment configuration file:

```bash
cp .env.example .env.local
```

Populate the variables in `.env.local` with your Firebase project configurations:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

### 2. Install Dependencies

Install packages using npm:

```bash
npm install
```

### 3. Local Development

Run the Next.js development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to view the application.

### 4. Build for Production

Compile the production bundle and run static optimizations:

```bash
npm run build
```

Verify the compiled build output starts locally:

```bash
npm run start
```
