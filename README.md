# Fantasy Football Auction & Season Manager

-- cloud run trigger test from cursor test -- 

A complete web application for managing fantasy football auctions and seasons, built with Next.js, Prisma, and PostgreSQL. Fully containerized with Docker for easy deployment and development.

## Features

### Core Functionality
- **User Authentication**: Secure registration and login system
- **Auction System**: Real-time bidding on players with £150m budget
- **Season Management**: 4-phase structure with transfer windows
- **Live Scoring**: Integration with Fantasy Premier League API
- **League Table**: Real-time standings and statistics
- **Player Database**: Comprehensive player search and analysis
- **Admin Panel**: Complete management interface for auctions and users

### Technical Features
- **Responsive Design**: Mobile-first with Tailwind CSS
- **Modern UI**: Built with shadcn/ui components
- **Real-time Updates**: Live auction bidding and scoring
- **Data Persistence**: PostgreSQL with Prisma ORM
- **Type Safety**: Full TypeScript implementation
- **Docker Support**: Complete containerization for development and production

## Tech Stack

### Frontend
- **Next.js 15** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling
- **shadcn/ui** - Modern component library
- **Framer Motion** - Smooth animations
- **React Hook Form** - Form management
- **NextAuth.js** - Authentication

### Backend
- **Next.js API Routes** - Serverless API endpoints
- **Prisma** - Database ORM
- **PostgreSQL** - Primary database
- **bcrypt** - Password hashing
- **Zod** - Schema validation

### Infrastructure
- **Docker** - Containerization
- **Docker Compose** - Multi-container orchestration
- **PostgreSQL 15** - Database container

## Quick Start with Docker

### Prerequisites
- Docker and Docker Compose installed
- Git (to clone the repository)
- Node.js (for FPL data management scripts)

### Option 1: Full Docker Setup (Recommended)

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd fpl-auction
   ```

2. **Create environment file**
   ```bash
   cp .env.example .env
   # Edit .env with your preferred settings
   ```

3. **Start the application**
   ```bash
   # Build and start all services
   docker-compose up --build
   ```

4. **Set up the database**
   ```bash
   # In a new terminal, run database setup
   docker-compose exec app npx prisma migrate dev --name init
   docker-compose exec app npx prisma db seed
   ```

5. **Access the application**
   - Application: http://localhost:3000
   - Database: localhost:5432

### Option 2: Development Setup (Database in Docker, App Local)

1. **Start only the database**
   ```bash
   docker-compose -f docker-compose.dev.yml up -d
   ```

2. **Install dependencies and run locally**
   ```bash
   npm install
   npm run dev
   ```

3. **Set up the database**
   ```bash
   npm run prisma:migrate
   npm run db:seed
   ```

## Detailed Setup Instructions

### Fresh Installation (Step-by-Step)

Follow these steps for a completely fresh installation:

1. **Clean up any existing Docker containers and volumes**
   ```bash
   # Stop and remove any existing containers
   docker-compose down -v
   
   # Remove any orphaned containers
   docker system prune -f
   
   # Remove any existing volumes (this will delete all data)
   docker volume prune -f
   ```

2. **Clone and navigate to the project**
   ```bash
   git clone <repository-url>
   cd fpl-auction
   ```

3. **Create environment file**
   ```bash
   cat > .env << 'EOF'
   DATABASE_URL="postgresql://postgres:postgres@postgres:5432/fpl_auction"
   NEXTAUTH_URL="http://localhost:3000"
   NEXTAUTH_SECRET="your-secret-key-here-change-this-in-production"
   EOF
   ```

4. **Start all services with Docker Compose**
   ```bash
   # Build and start all services
   docker-compose up --build -d
   
   # Check that all services are running
   docker-compose ps
   ```

5. **Wait for services to be ready**
   ```bash
   # Wait for PostgreSQL to be ready (about 10-15 seconds)
   sleep 15
   
   # Check logs if needed
   docker-compose logs postgres
   docker-compose logs app
   ```

6. **Set up the database**
   ```bash
   # Run database migrations
   docker-compose exec app npx prisma migrate dev --name init
   
   # Seed the database with player data
   docker-compose exec app npx prisma db seed
   ```

7. **Access the application**
   - Open your browser and navigate to http://localhost:3000
   - Create your first admin user at http://localhost:3000/auth/signup
   - Use username `Admin01` to access admin features

## 📊 FPL Data Management

The application includes scripts to download and upload FPL data, ensuring accurate player scores and gameweek information.

### Check Available Gameweeks
```bash
node check-available-gameweeks.js
```
Shows which gameweeks have data available, their status (finished/current), and phase information.

### Download FPL Data
```bash
node download-fpl-data.js
```
- Automatically detects all available gameweeks
- Downloads player, team, and points data
- Creates a timestamped JSON file for upload
- Future-proof: will download new gameweeks as they become available

### Upload to Application
1. Go to admin panel (Admin01 / Password)
2. Click "📤 Upload FPL Data" button
3. Select the generated JSON file
4. Wait for upload completion

### Resetting Admin01 Password

If you need to reset the Admin01 password, use the Cloud Run Job script:

**Prerequisites:**
- Docker image must include `reset-admin-password.js` (already included in Dockerfile)
- Deployed image must be available in Artifact Registry

**Steps:**

1. **Ensure you're in the web-app-source directory:**
   ```bash
   cd web-app-source
   ```

2. **Run the reset script:**
   ```bash
   ./reset-admin-password-cloud.sh
   ```

   The script will:
   - Use the default DATABASE_URL: `postgresql://fpluser:Simple123@localhost:5432/fpl_auction?host=/cloudsql/tuplff25-26:europe-west2:fpl-auction-db`
   - Create or update a Cloud Run Job
   - Execute the job to reset the password
   - Display the logs

3. **Login with:**
   - Username: `Admin01`
   - Password: `Password`

**Note:** You can override the DATABASE_URL by setting it as an environment variable:
```bash
export DATABASE_URL='your-custom-database-url'
./reset-admin-password-cloud.sh
```

### Future-Proof Features
- **Auto-detection**: Script automatically finds new gameweeks
- **Phase mapping**: Correctly assigns gameweeks to phases (1-4)
- **Error handling**: Continues if individual gameweeks fail
- **Rate limiting**: Respects FPL API limits
- **Data validation**: Ensures data integrity before upload

### Development Workflow

#### Making Changes
1. **Edit code** in your local environment
2. **Restart the app container** to see changes:
   ```bash
   docker-compose restart app
   ```
3. **View logs** if needed:
   ```bash
   docker-compose logs -f app
   ```

#### Database Changes
1. **Update Prisma schema** if needed
2. **Create migration**:
   ```bash
   docker-compose exec app npx prisma migrate dev --name your-migration-name
   ```
3. **Reset database** if needed:
   ```bash
   docker-compose exec app npx prisma migrate reset
   docker-compose exec app npx prisma db seed
   ```

#### Accessing the Database
```bash
# Connect to PostgreSQL directly
docker-compose exec postgres psql -U postgres -d fpl_auction

# Open Prisma Studio
docker-compose exec app npx prisma studio
```

## Docker Commands Reference

### Basic Commands
```bash
# Start all services
docker-compose up

# Start in background
docker-compose up -d

# Build and start
docker-compose up --build

# Stop all services
docker-compose down

# Stop and remove volumes
docker-compose down -v

# View logs
docker-compose logs
docker-compose logs -f app
docker-compose logs -f postgres

# Check service status
docker-compose ps
```

### Development Commands
```bash
# Run commands in the app container
docker-compose exec app npm run dev
docker-compose exec app npx prisma studio
docker-compose exec app npx prisma migrate dev

# Access database shell
docker-compose exec postgres psql -U postgres -d fpl_auction

# Restart specific service
docker-compose restart app
docker-compose restart postgres
```

### Cleanup Commands
```bash
# Remove all containers and volumes
docker-compose down -v

# Remove all unused Docker resources
docker system prune -a

# Remove specific volumes
docker volume ls
docker volume rm fpl-auction_postgres_data
```

## Project Structure

```
fpl-auction/
├── prisma/
│   ├── schema.prisma          # Database schema
│   ├── seed.ts               # Database seeding script
│   └── migrations/           # Database migrations
├── src/
│   ├── app/
│   │   ├── api/              # API routes
│   │   │   ├── auth/         # Authentication endpoints
│   │   │   ├── admin/        # Admin panel endpoints
│   │   │   ├── auction/      # Auction management
│   │   │   ├── gameweek/     # Gameweek updates
│   │   │   ├── managers/     # Manager data
│   │   │   └── players/      # Player data
│   │   ├── auth/             # Authentication pages
│   │   ├── dashboard/        # Main dashboard
│   │   ├── admin/            # Admin panel
│   │   ├── league/           # League table
│   │   ├── players/          # Player database
│   │   ├── auction/          # Auction interface
│   │   └── stats/            # Statistics page
│   ├── components/
│   │   ├── ui/               # shadcn/ui components
│   │   └── session-provider.tsx
│   └── lib/
│       ├── prisma.ts         # Database client
│       ├── auth.ts           # NextAuth configuration
│       ├── fpl.ts            # FPL API integration
│       ├── auction.ts        # Auction logic
│       └── scoring.ts        # Scoring system
├── Dockerfile                # Application container
├── docker-compose.yml        # Production setup
├── docker-compose.dev.yml    # Development setup
├── .dockerignore            # Docker ignore file
└── README.md
```

## Environment Variables

### Required Variables
```env
# Database connection
DATABASE_URL="postgresql://postgres:postgres@postgres:5432/fpl_auction"

# NextAuth configuration
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-here-change-this-in-production"

# Node environment
NODE_ENV="production"
```

### Optional Variables
```env
# Custom ports (if needed)
PORT=3000
DB_PORT=5432

# Additional NextAuth configuration
NEXTAUTH_DEBUG=true
```

## Troubleshooting

### Common Issues

**Container won't start:**
```bash
# Check logs
docker-compose logs app

# Rebuild containers
docker-compose up --build --force-recreate
```

**Database connection issues:**
```bash
# Check if PostgreSQL is running
docker-compose ps

# Check database logs
docker-compose logs postgres

# Restart database
docker-compose restart postgres
```

**Port conflicts:**
```bash
# Check what's using port 3000
lsof -i :3000

# Kill process using port
kill -9 <PID>

# Or change port in docker-compose.yml
```

**Permission issues:**
```bash
# Fix file permissions
sudo chown -R $USER:$USER .

# Rebuild containers
docker-compose up --build
```

**Database migration issues:**
```bash
# Reset database
docker-compose exec app npx prisma migrate reset

# Or manually reset
docker-compose down -v
docker-compose up --build
```

### Getting Help

1. **Check container logs:**
   ```bash
   docker-compose logs -f
   ```

2. **Verify services are running:**
   ```bash
   docker-compose ps
   ```

3. **Check resource usage:**
   ```bash
   docker stats
   ```

4. **Access container shell:**
   ```bash
   docker-compose exec app sh
   docker-compose exec postgres sh
   ```

## Production Deployment

### Google Cloud Run Deployment

1. **Prerequisites:**
   - Google Cloud Project with billing enabled
   - Artifact Registry repository created
   - Cloud SQL PostgreSQL instance (or external database)

2. **Set up environment variables:**
   ```bash
   # Generate a secure NextAuth secret
   openssl rand -base64 32
   
   # Set your environment variables
   export NEXTAUTH_SECRET="your-generated-secret-here"
   export DATABASE_URL="postgresql://user:password@host:5432/db"
   export PROJECT_ID="your-gcp-project-id"
   ```

3. **Deploy using Cloud Build:**
   ```bash
   # Submit build to Cloud Build
   gcloud builds submit --config cloudbuild.yaml \
     --substitutions=_NEXTAUTH_SECRET="$NEXTAUTH_SECRET",_DATABASE_URL="$DATABASE_URL"
   ```

4. **Manual deployment (alternative):**
   ```bash
   # Build and push image
   docker buildx build --platform linux/amd64 \
     -t europe-west2-docker.pkg.dev/$PROJECT_ID/web-app-repo/web-app:latest \
     --push .
   
   # Deploy to Cloud Run
   gcloud run deploy web-app \
     --image europe-west2-docker.pkg.dev/$PROJECT_ID/web-app-repo/web-app:latest \
     --region europe-west2 \
     --platform managed \
     --allow-unauthenticated \
     --port 3000 \
     --memory 2Gi \
     --cpu 2 \
     --max-instances 10 \
     --set-env-vars NODE_ENV=production \
     --set-env-vars NEXTAUTH_URL=https://web-app-884572147716.europe-west2.run.app \
     --set-env-vars NEXTAUTH_SECRET="$NEXTAUTH_SECRET" \
     --set-env-vars DATABASE_URL="$DATABASE_URL"
   ```

5. **Set up database:**
   ```bash
   # Connect to your Cloud Run service and run migrations
   gcloud run services proxy web-app --port=8080 --region=europe-west2
   
   # In another terminal, run migrations
   docker run --rm -e DATABASE_URL="$DATABASE_URL" \
     europe-west2-docker.pkg.dev/$PROJECT_ID/web-app-repo/web-app:latest \
     npx prisma migrate deploy
   
   # Seed the database
   docker run --rm -e DATABASE_URL="$DATABASE_URL" \
     europe-west2-docker.pkg.dev/$PROJECT_ID/web-app-repo/web-app:latest \
     npx prisma db seed
   ```

### Using Docker Compose in Production

1. **Set production environment variables:**
   ```env
   NODE_ENV=production
   DATABASE_URL="postgresql://user:password@host:5432/db"
   NEXTAUTH_URL="https://yourdomain.com"
   NEXTAUTH_SECRET="your-production-secret"
   ```

2. **Deploy with Docker Compose:**
   ```bash
   # On your production server
   git clone <repository-url>
   cd fpl-auction
   
   # Set up environment
   cp .env.example .env
   # Edit .env with production values
   
   # Deploy
   docker-compose up -d --build
   
   # Set up database
   docker-compose exec app npx prisma migrate deploy
   docker-compose exec app npx prisma db seed
   ```

### Using Docker Swarm or Kubernetes

The application is containerized and can be deployed to any container orchestration platform. The `docker-compose.yml` file can be used as a reference for Kubernetes manifests.

## Game Rules

### Auction System
- Each manager starts with £150m budget
- Bids must be in £0.5m increments
- Players sold to highest bidder
- Budget deducted upon winning bid

### Squad Requirements
- Exactly 11 players per squad
- Position limits: 1 GK, 3-4 DEF, 3-5 MID, 1-3 FWD
- Valid formations enforced

### Season Structure
- **Phase 1**: Gameweeks 1-11
- **Phase 2**: Gameweeks 12-26
- **Phase 3**: Gameweeks 27-31
- **Phase 4**: Gameweeks 32-38
- Transfer windows between phases

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test with Docker setup
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For questions or issues:
- Create an issue on GitHub
- Check the troubleshooting section
- Review the Docker logs for errors
