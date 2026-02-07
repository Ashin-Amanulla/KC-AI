# ShiftCare Viewer Dashboard

A read-only dashboard application for viewing shifts, staff, and clients from the ShiftCare API.

## Features

- **Dashboard**: View shifts with date range filters, summary statistics
- **Staff Management**: Browse and search staff members
- **Client Management**: Browse and search clients
- **Auto-refresh**: Data automatically refreshes every 5 minutes
- **Dual Authentication**: Supports environment variables or session-based login

## Tech Stack

- **Frontend**: Vite + React, Tailwind CSS, Shadcn UI, Zustand, TanStack Query
- **Backend**: Express.js, Express Session, Axios

## Setup Instructions

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file (copy from `.env.example`):
```bash
cp .env.example .env
```

4. Configure your `.env` file with ShiftCare API credentials:
```
SHIFTCARE_API_URL=https://api.shiftcare.com/api/v3
SHIFTCARE_API_KEY=your_api_key_here
SHIFTCARE_API_SECRET=your_api_secret_here
PORT=3001
NODE_ENV=development
SESSION_SECRET=your_session_secret_here_change_in_production
```

5. Start the backend server:
```bash
npm start
# or for development with auto-reload
npm run dev
```

The backend will run on `http://localhost:3001`

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file (optional, defaults to `http://localhost:3001`):
```
VITE_API_URL=http://localhost:3001
```

4. Start the development server:
```bash
npm run dev
```

The frontend will run on `http://localhost:5173`

## Usage

1. **Authentication**: 
   - If you've configured environment variables, the app will use them automatically
   - Otherwise, you'll be prompted to login with your ShiftCare API credentials

2. **Dashboard**: 
   - View summary statistics (total shifts, staff, clients)
   - Filter shifts by date range
   - View recent shifts in a table

3. **Staff Page**: 
   - Browse all staff members
   - Search by name
   - Paginate through results

4. **Clients Page**: 
   - Browse all clients
   - Search by name
   - Paginate through results

## API Endpoints

### Backend API

- `GET /api/shifts` - List shifts with optional filters
- `GET /api/staff` - List staff with optional filters
- `GET /api/clients` - List clients with optional filters
- `POST /api/auth/login` - Login with API credentials
- `POST /api/auth/logout` - Logout
- `GET /api/auth/status` - Check authentication status

## Project Structure

```
kc-ai/
├── backend/
│   ├── config/           # Configuration files
│   ├── middlewares/      # Auth middleware
│   ├── modules/
│   │   ├── auth/         # Authentication routes/controllers
│   │   └── shiftcare/    # ShiftCare API proxy
│   └── server.js         # Express server entry point
├── frontend/
│   ├── src/
│   │   ├── api/          # TanStack Query hooks
│   │   ├── components/   # React components
│   │   ├── pages/        # Page components
│   │   ├── store/        # Zustand stores
│   │   ├── ui/           # Shadcn UI components
│   │   └── utils/        # Utility functions
│   └── ...
└── README.md
```

## Notes

- All data is read-only - no create, update, or delete operations
- Data auto-refreshes every 5 minutes
- The backend acts as a proxy to avoid CORS issues and protect credentials
- Session-based authentication allows users to override environment credentials
