# Medusa Plugin Mondial Relay v2

A comprehensive Medusa.js v2 plugin for integrating Mondial Relay shipping services into your e-commerce platform. This plugin provides both API 1 (SOAP) for relay point search and API 2 (REST) for shipment creation and tracking.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Configuration](#configuration)
- [API Endpoints](#api-endpoints)
- [Services](#services)
- [Admin Interface](#admin-interface)
- [Frontend Integration](#frontend-integration)
- [Environment Variables](#environment-variables)
- [Development](#development)
- [Troubleshooting](#troubleshooting)

## Features

### 🚚 **Mondial Relay API 1 (SOAP)**
- **Relay Point Search**: Find nearby relay points by postal code, city, or GPS coordinates
- **Real-time Data**: Live integration with Mondial Relay's official API
- **Multiple Search Methods**: Support for postal code, city name, and GPS coordinates
- **Point Details**: Complete relay point information including opening hours, distance, and type

### 📦 **Mondial Relay API 2 (REST)**
- **Shipment Creation**: Create shipments with real tracking numbers
- **Label Generation**: Generate shipping labels in PDF format
- **Tracking**: Real-time shipment tracking
- **Order Integration**: Seamless integration with Medusa orders and metadata

### 🎯 **Fulfillment Provider**
- **Automatic Fulfillment**: Process orders through Mondial Relay
- **Dimension Calculation**: Intelligent parcel dimension calculation from order items
- **Weight Management**: Automatic weight calculation and validation
- **Metadata Storage**: Store tracking information in order metadata

### 🖥️ **Admin Interface**
- **Shipment Management**: View and manage all Mondial Relay shipments
- **Label Downloads**: Download shipping labels directly from admin
- **Tracking Interface**: Real-time tracking information
- **Order Integration**: Direct access to order details and metadata

## Installation

### Prerequisites
- Medusa.js v2.4.0 or higher
- Node.js 20 or higher
- PostgreSQL database
- Mondial Relay API credentials

### Install the Plugin

```bash
# Clone the repository
git clone <repository-url>
cd medusa-plugin-mondial-relay-v2

# Install dependencies
npm install

# Build the plugin
npm run build

# Publish with yalc (for local development)
yalc publish
```

### Add to Medusa Backend

```bash
# In your Medusa backend directory
yalc add medusa-plugin-mondial-relay-v2
npm install
```

### Configure in medusa-config.ts

```typescript
import { loadEnv, defineConfig } from '@medusajs/framework/utils'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET,
      cookieSecret: process.env.COOKIE_SECRET,
    }
  },
  modules: [
    {
      resolve: "./src/modules/{your-modules}",
    },
  ],
  plugins: [
    {
      resolve: "medusa-plugin-mondial-relay-v2",
      options: {
        // Plugin options are configured via environment variables
      }
    }
  ],
  admin: {
    vite: () => {
      return {
        optimizeDeps: {
          include: ["@medusajs/icons", "@medusajs/admin-sdk"]
        }
      }
    }
  }
})
```

## Configuration

### Environment Variables

Create a `.env` file in your Medusa backend with the following variables:

```env
# Mondial Relay API 1 (SOAP) Configuration
MONDIAL_RELAY_API1_URL=https://api.mondialrelay.com/Web_Services.asmx
MONDIAL_RELAY_ENSEIGNE=YOUR_ENSEIGNE
MONDIAL_RELAY_PRIVATE_KEY=YOUR_PRIVATE_KEY

# Mondial Relay API 2 (REST) Configuration
MONDIAL_RELAY_API_BASE_URL=https://connect-api-sandbox.mondialrelay.com
MONDIAL_RELAY_LOGIN=YOUR_LOGIN@business-api.mondialrelay.com
MONDIAL_RELAY_PASSWORD=YOUR_PASSWORD
MONDIAL_RELAY_CUSTOMER_ID=YOUR_CUSTOMER_ID

# Business Address (Sender Information)
BUSINESS_TITLE=Mr
BUSINESS_FIRSTNAME=Your First Name
BUSINESS_LASTNAME=Your Last Name
BUSINESS_STREET=Your Street Address
BUSINESS_HOUSE_NO=Your House Number
BUSINESS_COUNTRY_CODE=FR
BUSINESS_POSTCODE=Your Postal Code
BUSINESS_CITY=Your City
BUSINESS_PHONE=Your Phone Number
BUSINESS_MOBILE=Your Mobile Number
BUSINESS_EMAIL=your.email@domain.com

# Medusa admin API (fulfillment provider)
# Required when the Order module is not available from the fulfillment provider container.
# No default values. Plugin options adminBaseUrl, adminEmail and adminPassword override these.
ADMIN_BASE_URL=https://your-medusa-backend.example.com
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=YOUR_ADMIN_PASSWORD
```

### Production vs Sandbox

- **Sandbox**: Use `https://connect-api-sandbox.mondialrelay.com` for testing
- **Production**: Use `https://connect-api.mondialrelay.com` for live operations

## API Endpoints

### Store API (Public)

#### Get Shipping Rates
```http
GET /store/mondial-relay/rates?cart_id={cart_id}
```

**Response:**
```json
{
  "rates": [
    {
      "id": "mondial-relay-24R",
      "name": "Mondial Relay Point Relais Standard",
      "price": 417,
      "deliveryMode": "24R",
      "estimatedDays": 2,
      "description": "Livraison en point relais standard"
    }
  ]
}
```

#### Search Relay Points
```http
GET /store/mondial-relay/relay-points?zipCode={zipCode}&city={city}
GET /store/mondial-relay/relay-points?latitude={lat}&longitude={lng}
```

**Response:**
```json
{
  "relayPoints": [
    {
      "id": "FR-071039",
      "name": "RELAIS COLIS",
      "address": "8 RUE DOUDEAUVILLE",
      "city": "PARIS",
      "zipCode": "75018",
      "country": "FR",
      "latitude": 48.8846,
      "longitude": 2.3469,
      "openingHours": ["Lun-Ven: 9h-19h", "Sam: 9h-12h"],
      "distance": 0.5,
      "type": "RELAY"
    }
  ]
}
```

#### Track Shipment
```http
GET /store/mondial-relay/tracking/{trackingNumber}
```

### Admin API (Authenticated)

#### Get All Shipments
```http
GET /admin/mondial-relay/shipments
```

#### Create Shipment
```http
POST /admin/mondial-relay/shipments
Content-Type: application/json

{
  "orderId": "order_123",
  "relayPointId": "FR-071039",
  "weight": 1000,
  "deliveryMode": "24R",
  "recipient": {
    "title": "M.",
    "firstname": "John",
    "lastname": "Doe",
    "streetname": "123 Main St",
    "houseNo": "",
    "countryCode": "FR",
    "postCode": "75001",
    "city": "Paris",
    "phoneNo": "0123456789",
    "email": "john@example.com"
  }
}
```

#### Download Label
```http
GET /admin/mondial-relay/label/{shipmentNumber}
```

#### Update Order Metadata
```http
POST /admin/mondial-relay/update-order-metadata
Content-Type: application/json

{
  "orderId": "order_123",
  "metadata": {
    "trackingNumber": "MR123456789",
    "labelUrl": "https://...",
    "relayPointId": "FR-071039"
  }
}
```

## Services

### MondialRelayAPI1Service

**Purpose**: Handle relay point search using Mondial Relay's SOAP API

**Key Methods:**
- `searchRelayPoints(params)`: Search for relay points
- `generateSecurityKey(params)`: Generate MD5 security key for API authentication

**Usage:**
```typescript
import { MondialRelayAPI1Service } from './services/mondial-relay-api1.service'

const api1Service = new MondialRelayAPI1Service(
  'https://api.mondialrelay.com/Web_Services.asmx',
  'YOUR_ENSEIGNE',
  'YOUR_PRIVATE_KEY'
)

const relayPoints = await api1Service.searchRelayPoints({
  zipCode: '75001',
  city: 'Paris',
  countryCode: 'FR'
})
```

### MondialRelayAPI2Service

**Purpose**: Handle shipment creation and tracking using Mondial Relay's REST API

**Key Methods:**
- `createShipment(data)`: Create a new shipment
- `trackShipment(trackingNumber)`: Track an existing shipment
- `buildShipmentXML(data)`: Build XML request for shipment creation
- `parseShipmentResponse(response)`: Parse API response

**Usage:**
```typescript
import { MondialRelayAPI2Service } from './services/mondial-relay-api2.service'

const api2Service = new MondialRelayAPI2Service(
  'https://connect-api-sandbox.mondialrelay.com',
  'YOUR_LOGIN',
  'YOUR_PASSWORD',
  'YOUR_CUSTOMER_ID'
)

const shipment = await api2Service.createShipment({
  orderNumber: 'ORDER_123',
  customerNumber: 'CUSTOMER_456',
  deliveryMode: '24R',
  location: 'FR-071039',
  weight: 1000,
  content: 'Products',
  recipient: { /* recipient data */ },
  sender: { /* sender data */ }
})
```

### MondialRelayFulfillmentService

**Purpose**: Medusa fulfillment provider for automatic order processing

**Key Methods:**
- `createFulfillment()`: Process order fulfillment
- `validateFulfillmentData()`: Validate fulfillment data
- `updateOrderMetadata()`: Update order with tracking information

**Configuration:**
```typescript
// In medusa-config.ts
{
  resolve: "medusa-plugin-mondial-relay-v2",
  options: {
    // Options are loaded from environment variables
  }
}
```

## Admin Interface

### Shipment Management Page

Access the Mondial Relay admin interface at `/app/mondial-relay` in your Medusa admin.

**Features:**
- View all shipments with tracking numbers
- Download shipping labels
- Track shipment status
- View relay point information
- Export shipment data

### Admin Route Configuration

The admin interface is automatically registered when the plugin is installed. No additional configuration is required.

## Frontend Integration

### React Components

The plugin provides React components for frontend integration:

#### MondialRelaySelector
```typescript
import { MondialRelaySelector } from './components/mondial-relay-selector'

<MondialRelaySelector
  onSelectPoint={(point) => {
    // Handle relay point selection
    console.log('Selected point:', point)
  }}
  zipCode="75001"
  city="Paris"
/>
```

#### MondialRelayRates
```typescript
import { MondialRelayRates } from './components/mondial-relay-rates'

<MondialRelayRates
  cartId="cart_123"
  onSelectRate={(rate) => {
    // Handle rate selection
    console.log('Selected rate:', rate)
  }}
/>
```

### API Integration

#### Fetch Shipping Rates
```typescript
const fetchRates = async (cartId: string) => {
  const response = await fetch(`/store/mondial-relay/rates?cart_id=${cartId}`)
  const data = await response.json()
  return data.rates
}
```

#### Search Relay Points
```typescript
const searchRelayPoints = async (zipCode: string, city: string) => {
  const response = await fetch(`/store/mondial-relay/relay-points?zipCode=${zipCode}&city=${city}`)
  const data = await response.json()
  return data.relayPoints
}
```

#### Create Shipment
```typescript
const createShipment = async (orderId: string, relayPointId: string) => {
  const response = await fetch('/admin/mondial-relay/shipments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      orderId,
      relayPointId,
      weight: 1000,
      deliveryMode: '24R'
    })
  })
  return response.json()
}
```

## Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `MONDIAL_RELAY_API1_URL` | API 1 SOAP endpoint | `https://api.mondialrelay.com/Web_Services.asmx` |
| `MONDIAL_RELAY_ENSEIGNE` | Your enseigne code | `YOUR_ENSEIGNE` |
| `MONDIAL_RELAY_PRIVATE_KEY` | Your private key | `YOUR_PRIVATE_KEY` |
| `MONDIAL_RELAY_API_BASE_URL` | API 2 REST base URL | `https://connect-api-sandbox.mondialrelay.com` |
| `MONDIAL_RELAY_LOGIN` | API 2 login | `your-login@business-api.mondialrelay.com` |
| `MONDIAL_RELAY_PASSWORD` | API 2 password | `YOUR_PASSWORD` |
| `MONDIAL_RELAY_CUSTOMER_ID` | Your customer ID | `YOUR_CUSTOMER_ID` |

### Business Address Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `BUSINESS_TITLE` | Sender title | `Mr` |
| `BUSINESS_FIRSTNAME` | Sender first name | `John` |
| `BUSINESS_LASTNAME` | Sender last name | `Doe` |
| `BUSINESS_STREET` | Street address | `123 Main Street` |
| `BUSINESS_HOUSE_NO` | House number | `123` |
| `BUSINESS_COUNTRY_CODE` | Country code | `FR` |
| `BUSINESS_POSTCODE` | Postal code | `75001` |
| `BUSINESS_CITY` | City | `Paris` |
| `BUSINESS_PHONE` | Phone number | `0123456789` |
| `BUSINESS_MOBILE` | Mobile number | `0123456789` |
| `BUSINESS_EMAIL` | Email address | `contact@example.com` |

### Medusa admin API

The fulfillment provider reads relay-point metadata from the order and writes tracking data back. It uses the internal Order module when that module is available in its container. Otherwise it calls the Medusa admin HTTP API and authenticates with `POST /auth/user/emailpass`.

There is no built-in email, password, or base URL. Set either the environment variables below or the provider options `adminBaseUrl`, `adminEmail`, and `adminPassword`. Options take precedence over environment variables. If the Order module is unavailable and any value is missing, fulfillment fails with an explicit error and nothing secret is logged.

Register the provider in the host `medusa-config.ts`:

```typescript
{
  resolve: "@medusajs/medusa/fulfillment",
  options: {
    providers: [
      {
        resolve: "medusa-plugin-mondial-relay-v2/providers/mondial-relay",
        id: "mondial-relay",
        options: {
          adminBaseUrl: process.env.ADMIN_BASE_URL,
          adminEmail: process.env.ADMIN_EMAIL,
          adminPassword: process.env.ADMIN_PASSWORD,
        },
      },
    ],
  },
}
```

| Variable | Description | Example |
|----------|-------------|---------|
| `ADMIN_BASE_URL` | Medusa backend origin, without a trailing slash | `https://your-medusa-backend.example.com` |
| `ADMIN_EMAIL` | Admin user email used for the admin API | `admin@example.com` |
| `ADMIN_PASSWORD` | Password of that admin user | `YOUR_ADMIN_PASSWORD` |

## Development

### Project Structure

```
medusa-plugin-mondial-relay-v2/
├── src/
│   ├── admin/                    # Admin interface
│   │   └── routes/
│   │       └── mondial-relay/
│   │           └── page.tsx      # Admin page component
│   ├── api/                      # API routes
│   │   ├── admin/               # Admin API endpoints
│   │   │   └── mondial-relay/
│   │   │       ├── shipments/   # Shipment management
│   │   │       ├── label/       # Label downloads
│   │   │       └── tracking/    # Tracking endpoints
│   │   └── store/               # Store API endpoints
│   │       └── mondial-relay/
│   │           ├── rates/       # Shipping rates
│   │           ├── relay-points/ # Relay point search
│   │           └── tracking/     # Public tracking
│   ├── providers/               # Fulfillment provider
│   │   └── mondial-relay/
│   │       ├── index.ts         # Provider registration
│   │       └── service.ts       # Fulfillment service
│   ├── services/                # Core services
│   │   ├── mondial-relay-api1.service.ts  # API 1 service
│   │   ├── mondial-relay-api2.service.ts  # API 2 service
│   │   └── ign-geocoding.service.ts       # Geocoding service
│   └── index.ts                 # Plugin entry point
├── package.json
├── tsconfig.json
└── README.md
```

### Building the Plugin

```bash
# Development build
npm run dev

# Production build
npm run build

# Publish with yalc
yalc publish
```

### Testing

```bash
# Run tests (if available)
npm test

# Test API endpoints
curl -X GET "http://localhost:9000/store/mondial-relay/rates?cart_id=test"
curl -X GET "http://localhost:9000/store/mondial-relay/relay-points?zipCode=75001&city=Paris"
```

### Debugging

Enable debug logging by setting the following environment variable:

```env
DEBUG=medusa-plugin-mondial-relay-v2:*
```

## Troubleshooting

### Common Issues

#### 1. API Authentication Errors

**Error**: `Invalid credentials` or `Authentication failed`

**Solution**: 
- Verify your API credentials in the `.env` file
- Ensure you're using the correct environment (sandbox vs production)
- Check that your enseigne and private key are correct

#### 2. Relay Point Search Not Working

**Error**: `No relay points found` or `API 1 error`

**Solution**:
- Verify the postal code format (5 digits for France)
- Check that the city name is spelled correctly
- Ensure your API 1 credentials are valid
- Try using GPS coordinates instead of postal code

#### 3. Shipment Creation Fails

**Error**: `Shipment creation failed` or `API 2 error`

**Solution**:
- Verify all required fields are provided
- Check that the relay point ID is valid
- Ensure the weight is within Mondial Relay limits (max 3kg)
- Verify parcel dimensions are within limits

#### 4. Label Download Issues

**Error**: `Label not found` or `Download failed`

**Solution**:
- Ensure the shipment was created successfully
- Check that the tracking number is correct
- Verify the label URL is accessible
- Try regenerating the shipment

### Debug Mode

Enable detailed logging by adding these environment variables:

```env
DEBUG=medusa-plugin-mondial-relay-v2:*
MONDIAL_RELAY_DEBUG=true
```

### API Response Logging

The plugin logs all API requests and responses. Check your Medusa logs for detailed information:

```bash
# View logs
tail -f logs/medusa.log

# View specific plugin logs
grep "Mondial Relay" logs/medusa.log
```

### Support

For additional support:

1. Check the [Medusa.js documentation](https://docs.medusajs.com)
2. Review the [Mondial Relay API documentation](https://www.mondialrelay.com/api/)
3. Open an issue in the plugin repository
4. Contact Mondial Relay support for API-specific issues

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## Changelog

### v0.0.2
- Removed hardcoded Medusa admin credentials from the Mondial Relay fulfillment provider. Order updates use the internal Order module when it is available. Otherwise the provider reads `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `ADMIN_BASE_URL` (or the provider options `adminEmail`, `adminPassword`, and `adminBaseUrl`) and fails with a clear error when they are missing. No default URL, email, or password.
- Stopped logging private keys, passwords, SOAP security hashes, signed request XML, tokens, and Authorization headers.

### v0.0.1
- Initial release
- API 1 integration for relay point search
- API 2 integration for shipment creation
- Admin interface for shipment management
- Fulfillment provider integration
- Frontend components for store integration