# Poultry Biosecurity System
MVP built with FastAPI, React, Leaflet, and PostgreSQL.

## Backend Setup
1. `cd backend`
2. `pip install -r requirements.txt`
3. `uvicorn main:app --reload`

## Frontend Setup
1. `cd frontend`
2. `npm install`
3. `npm start`

# Farm Signal — merged crop scanner + WhatsApp setup

## What was merged
- Existing live farm map, zone risk and history dashboard.
- Crop Disease Scanner moved into the React dashboard.
- Browser no longer calls Anthropic directly. Images are uploaded to FastAPI `/crop-diagnosis`, keeping `ANTHROPIC_API_KEY` on the server.
- WhatsApp webhook now supports Meta verification and sends real WhatsApp replies through WhatsApp Cloud API when configured.

## Backend environment variables
Set these on the backend host (for example Render), never in the React frontend:

```env
DATABASE_URL=...
ANTHROPIC_API_KEY=...
ANTHROPIC_MODEL=claude-sonnet-4-6
FRONTEND_ORIGIN=https://biosecurity-dashboard-c7yrbsais-spated.vercel.app
WHATSAPP_ACCESS_TOKEN=...
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_VERIFY_TOKEN=choose-a-secret-value
WHATSAPP_DISPLAY_NUMBER=+91XXXXXXXXXX
```

`WHATSAPP_DISPLAY_NUMBER` is only the number shown in the dashboard. The actual WhatsApp Business number must be registered/configured in Meta WhatsApp Cloud API, and `WHATSAPP_PHONE_NUMBER_ID` identifies that business number to the API.

## WhatsApp webhook
Set the Meta webhook callback URL to:

`https://YOUR-BACKEND-DOMAIN/whatsapp/webhook`

Use the same `WHATSAPP_VERIFY_TOKEN` in Meta and the backend environment. Subscribe to the `messages` webhook field.

## Frontend deployment
Set this Vercel environment variable:

```env
REACT_APP_API_URL=https://YOUR-BACKEND-DOMAIN
```

Then redeploy the frontend.
