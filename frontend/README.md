# ChainBudget - Frontend

This directory contains the user interface and frontend logic for ChainBudget. It is built using **Next.js 14** (App Router) and is designed to provide a seamless, modern, and mobile-responsive experience for requesters, approvers, and administrators.

## 🛠️ Technology Stack

*   **Framework:** [Next.js 14](https://nextjs.org/) (React framework with App Router)
*   **Styling:** [Tailwind CSS](https://tailwindcss.com/) (Utility-first CSS)
*   **Authentication:** [Asgardeo by WSO2](https://wso2.com/asgardeo/) (OIDC Authentication Provider)
*   **Icons:** [Lucide React](https://lucide.dev/)
*   **Data Visualization:** [Recharts](https://recharts.org/) (for the Cash Flow graph)

## 📂 Folder Structure

*   `/src/app`: Contains all the Next.js routes/pages (e.g., `/dashboard`, `/admin`, `/reports`).
*   `/src/components`: Reusable UI components (buttons, modals, headers).
*   `/src/lib`: Utility functions, API helpers, and configuration files (e.g., wallet helpers).

## 🔐 Authentication (Asgardeo)

ChainBudget uses Asgardeo to handle secure user logins and identity management. 
Users are assigned specific roles (e.g., `Secretary`, `Vice-President`, `OrgAdmin`) within the Asgardeo console. The frontend decodes the JWT token returned by Asgardeo to determine the user's role and restrict access to specific dashboard features (like the "Approve" button or the Super Admin console).

## 🚀 Local Development Setup

### 1. Install Dependencies
Make sure you are inside the `/frontend` directory, then run:
```bash
npm install
```

### 2. Environment Variables
Create a `.env.local` file in the root of the `/frontend` directory and add the following variables:
```env
NEXT_PUBLIC_ASGARDEO_BASE_URL=https://api.asgardeo.io/t/your_org_name
NEXT_PUBLIC_ASGARDEO_CLIENT_ID=your_client_id
NEXT_PUBLIC_ASGARDEO_REDIRECT_URL=http://localhost:3000
NEXT_PUBLIC_CONTRACT_ADDRESS=your_deployed_smart_contract_address
```
*(Contact the backend team or check your Asgardeo dashboard for the correct credentials).*

### 3. Run the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## 📱 Mobile Responsiveness
The UI is fully responsive. We utilize Tailwind's standard breakpoints (e.g., `sm:`, `md:`, `lg:`) to ensure tables, graphs, and approval modals fit perfectly on mobile devices.
