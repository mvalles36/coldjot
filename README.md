# ColdJot

ColdJot is a modern web application for managing and automating email operations with a focus on productivity and efficiency.

## 🌟 Features

- **User Authentication**: Secure sign-in and sign-up functionality with Google OAuth integration
- **Email Operations**: Advanced email management and automation capabilities
- **Modern Web Interface**: Responsive design with a clean, intuitive user interface
- **Real-time Processing**: Queue-based processing for efficient email operations
- **Multi-environment Support**: Development, production, and custom environment configurations

## 🏗️ Project Structure

The project follows a monorepo structure with multiple applications:

```
apps/
├── web/           # Main web application (Next.js)
└── mailops/       # Email operations service
```

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or higher)
- PostgreSQL
- Redis

### Installation

1. Clone the repository:

```bash
git clone https://github.com/your-org/coldjot.git
cd coldjot
```

2. Install dependencies:

```bash
npm install
```

3. Set up environment variables:

   - Copy the example env files in `apps/web/env/` and `apps/mailops/env/`
   - Configure the necessary environment variables

4. Start the development server:

```bash
npm run dev
```

## 🔧 Configuration

The application requires several environment variables to be set:

- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`: Redis configuration
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`: Google OAuth credentials
- Additional environment-specific variables

## 🛠️ Tech Stack

- **Frontend**: Next.js, React, TypeScript, TailwindCSS
- **Backend**: Node.js
- **Database**: PostgreSQL
- **Caching**: Redis
- **Authentication**: NextAuth.js with Google OAuth
- **Infrastructure**: Production-ready deployment setup

## 🔐 Security

- Secure authentication flow with NextAuth.js
- Environment-based configuration management
- Protected API routes
- Secure session handling

## 📝 License

[Your License Here]

## 🤝 Contributing

[Your Contributing Guidelines Here]

---

For more information, please contact the development team.
