# TDF Mobile - Social Event Calendar Feature

## Overview
The Social Event Calendar is a comprehensive mobile feature that enables users to discover, create, and manage social events with artist profiles, venue management, and RSVP functionality. This document outlines the completed frontend implementation and the backend requirements.

## Completed Features

### 🎯 Core Functionality

#### Events Discovery & Management
- **Events Tab** (`app/(tabs)/events.tsx`)
  - Calendar view showing events by date with color-coded indicators
  - List view with all upcoming events
  - City-based search filter with debounced input
  - Toggle between calendar and list views
  - Event listing sorted by date

- **Event Creation** (`app/createEvent.tsx`)
  - Comprehensive form with validation
  - Date/time picker for start and end times
  - Modal-based venue selection with search
  - Modal-based multi-select for artists
  - Quick creation of new venues and artists from modals
  - Ticket pricing and purchase URL fields
  - Visibility toggle (public/private events)
  - Real-time validation

- **Event Details** (`app/eventDetail.tsx`)
  - Full event information display
  - Venue details with address and location
  - List of performing artists with genres
  - Event description and ticket information
  - RSVP functionality (Going, Interested, Not Going)
  - Visual RSVP status feedback
  - Friend invitation placeholder (ready for implementation)
  - Direct ticket purchase link via Linking API

#### Artist Profile Management
- **Artist Profile Creation** (`app/createArtistProfile.tsx`)
  - Artist name, bio, and image URL
  - Genre multi-select from predefined list
  - Social links (Instagram handle, Spotify URL)
  - Form validation

- **Artist Profile Details** (`app/artistDetail.tsx`)
  - View full artist profile
  - List of upcoming events they're performing in
  - Genre tags and social links
  - Edit profile button with navigation

- **Artist Profile Editing** (`app/editArtistProfile.tsx`)
  - Full profile information update
  - Genre selection with visual feedback
  - Selected genres display with tag UI
  - Toggle genre selection in grid layout

#### Venue Management
- **Venue Explorer** (`app/venueExplorer.tsx`)
  - Geolocation-based venue discovery
  - Current location detection using expo-location
  - Configurable search radius (1-999 km)
  - Distance calculation using Haversine formula
  - Venues sorted by distance from user
  - Map view toggle (UI prepared, map implementation pending)
  - Quick venue creation button

- **Venue Creation** (`app/createVenue.tsx`)
  - Comprehensive venue form
  - Geolocation fields (latitude/longitude)
  - Address, city, state, postal code
  - Capacity and contact information
  - Website URL field
  - Image URL for venue photo

- **Venue Details** (`app/venueDetail.tsx`)
  - Full venue information display
  - Geolocation coordinates
  - Contact information (phone, website)
  - List of upcoming events at venue
  - Quick event creation at this venue

#### User Profile
- **User Profile Screen** (`app/userProfile.tsx`)
  - Tabbed interface (Artist Profile, Attending, Saved)
  - Artist Profile tab - view/edit artist profile
  - Attending tab - list of upcoming events user is attending
  - Saved tab - placeholder for saved events feature
  - User information display with avatar placeholder

### 🎨 UI Components

- **EventCard** (`src/components/EventCard.tsx`)
  - Memoized component for performance
  - Event image, title, date/time, venue, artists, price
  - RSVP count display
  - Responsive styling with shadow effects

- **ArtistCard** (`src/components/ArtistCard.tsx`)
  - Memoized artist card
  - Image, name, bio (2-line limit), genres
  - Genre tags with background chips
  - Clean, consistent styling

### 🔌 API Client Layer

- **Events API** (`src/api/events.ts`)
  - `list()` - List events with city/artist/upcomingOnly filters
  - `getById()` - Fetch single event with related data
  - `create()` - Create new event
  - `update()` - Update event
  - `delete()` - Delete event
  - `getRSVPs()` - Get RSVPs for event
  - `rsvp()` - Create/update RSVP
  - `updateRSVP()` - Update RSVP status
  - `sendInvitation()` - Send friend invitation
  - `getInvitations()` - Fetch invitations
  - `respondToInvitation()` - Accept/decline invitation

- **Artists API** (`src/api/artists.ts`)
  - `getById()` - Fetch artist profile
  - `getByParty()` - Get artist by party ID
  - `create()` - Create artist profile
  - `update()` - Update artist profile
  - `searchByName()` - Search artists
  - `searchByGenre()` - Filter by genre

- **Venues API** (`src/api/venues.ts`)
  - `list()` - List venues with optional filters
  - `getById()` - Fetch venue details
  - `create()` - Create venue
  - `update()` - Update venue
  - `search()` - Text search venues

### 📦 Type System

Extended `src/types/index.ts` with comprehensive types:
- `ArtistProfile`, `ArtistProfileCreate`
- `Venue`, `VenueCreate`
- `SocialEvent`, `SocialEventCreate`, `SocialEventUpdate`
- `EventRSVP`, `EventRSVPCreate`
- `EventInvitation`, `EventInvitationCreate`
- `RSVPStatus` enum

### 🎛️ Navigation

- **Tab Navigation** Updated with icons
  - Parties, Bookings, Pipelines, Events, vCard, About
  - Material Community Icons for visual feedback
  - Color-coded active tab state

- **Screen Routes** (via Expo Router)
  - `/events` - Main events discovery (tab)
  - `/createEvent` - Event creation form
  - `/eventDetail?eventId=...` - Event details
  - `/venueExplorer` - Venue discovery with geolocation
  - `/venueDetail?venueId=...` - Venue details
  - `/createVenue` - Venue creation
  - `/createArtistProfile` - Artist profile creation
  - `/artistDetail?artistId=...` - Artist profile view
  - `/editArtistProfile?artistId=...` - Artist profile editing
  - `/userProfile` - User profile and preferences

## Architecture & Performance

### Performance Optimizations
- ✅ Component memoization with `memo()`
- ✅ Callback optimization with `useCallback`
- ✅ List rendering optimization with `FlatList` virtualization
- ✅ Debounced search inputs
- ✅ Memoized data transformations with `useMemo`
- ✅ Query key organization for efficient cache invalidation

### State Management
- React Query 5.90.5 for server state
- Local component state for UI
- Callback-based event handling

### Code Quality
- ✅ ESLint 9 with TypeScript support
- ✅ No linting errors (0 errors, 0 warnings)
- ✅ Full TypeScript type coverage
- ✅ Consistent code style

## Backend Requirements

See `SOCIAL_EVENTS_IMPLEMENTATION.md` for detailed backend specifications including:
- Database models and migrations
- DTO definitions
- API endpoint specifications
- Authentication & authorization
- Query parameters and filters
- Implementation checklist

### Key Backend Tasks
1. Create database models for SocialEvent, ArtistProfile, Venue, EventRSVP, EventInvitation
2. Implement API endpoints for all CRUD operations
3. Add geolocation-based venue querying
4. Implement RSVP and invitation workflows
5. Generate OpenAPI schema
6. Regenerate TypeScript clients with `npm run generate:api:ui` and `npm run generate:api:mobile`

## Dependencies Used

- `@tanstack/react-query` - Server state management
- `expo-router` - Navigation and routing
- `expo-location` - Geolocation services
- `react-native-calendars` - Calendar component
- `@react-native-community/datetimepicker` - Date/time picker
- Material Community Icons via `@expo/vector-icons`

## Testing & Quality Assurance

### Manual Testing Checklist
- [ ] Events discovery and filtering
- [ ] Event creation with all field combinations
- [ ] RSVP functionality
- [ ] Artist profile creation and editing
- [ ] Venue creation with geolocation
- [ ] Venue explorer with distance calculation
- [ ] Navigation between screens
- [ ] Modal-based selections

### Future Enhancements
- [ ] Map view for venues (React Native Maps integration)
- [ ] Photo upload for events/artists/venues
- [ ] User following/friends system
- [ ] Push notifications for RSVPs and invitations
- [ ] Event calendar sync with device calendar
- [ ] Social sharing (WhatsApp, Instagram, etc.)
- [ ] Event recommendations based on genres/location
- [ ] Reviews and ratings for venues/events
- [ ] Payment integration for ticket purchases
- [ ] QR code generation for event check-in

## Commit History
- `28a055a` - feat: complete social event calendar MVP with venue/artist management screens
- `3acde56` - feat: add venue explorer, venue detail, user profile screens with geolocation support

## File Structure
```
app/
├── (tabs)/
│   ├── events.tsx              # Main events tab
│   └── _layout.tsx             # Tab navigation
├── createEvent.tsx             # Event creation form
├── eventDetail.tsx             # Event details view
├── createVenue.tsx             # Venue creation form
├── venueDetail.tsx             # Venue details view
├── venueExplorer.tsx           # Venue discovery with geolocation
├── createArtistProfile.tsx     # Artist profile creation
├── artistDetail.tsx            # Artist profile view
├── editArtistProfile.tsx       # Artist profile editor
└── userProfile.tsx             # User profile dashboard

src/
├── api/
│   ├── events.ts               # Events API client
│   ├── venues.ts               # Venues API client
│   └── artists.ts              # Artists API client
├── components/
│   ├── EventCard.tsx           # Event card component
│   └── ArtistCard.tsx          # Artist card component
└── types/
    └── index.ts                # Type definitions
```

## Quick Start

### Development
```bash
cd tdf-mobile
npm install
npm run dev:mobile
```

### Linting
```bash
npm run lint
```

### Build
```bash
npm run build
```

## Notes for Team

1. **Backend Integration**: The mobile app is ready to consume the backend API. Once the Haskell backend implements the endpoints defined in `SOCIAL_EVENTS_IMPLEMENTATION.md`, the mobile app will automatically work with the new data.

2. **API Client Generation**: After backend implements endpoints and generates OpenAPI schema, regenerate the TypeScript clients:
   ```bash
   npm run generate:api:mobile
   ```

3. **Environment Configuration**: Set up the following environment variables in `.env`:
   ```
   VITE_API_BASE=http://localhost:8080
   EXPO_PUBLIC_API_BASE=http://localhost:8080
   ```

4. **Location Permissions**: The app requests location permissions for the venue explorer. Ensure proper OS-level permission handling is tested on both iOS and Android.

5. **Geolocation**: The Haversine formula is used for distance calculations. Coordinates should be stored as doubles with high precision for accurate distance calculations.
