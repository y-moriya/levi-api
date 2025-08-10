# Levi API - Werewolf Game REST API

A RESTful API implementation of the Werewolf (Mafia) game built with Deno and Hono framework. This project implements an
in-memory game state management system with essential game functionalities.

## 🚀 Tech Stack

- **Runtime**: Deno
- **Framework**: Hono
- **Storage**: In-memory (Object-based)
- **Authentication**: JWT

## 📦 Project Structure

```
/
├── main.ts                # Entry point
├── config.ts              # Configuration
├── routes/                # Route definitions
├── controllers/           # Request handlers
├── models/               # Data models
├── services/             # Business logic
├── middleware/           # Middleware functions
├── utils/                # Utilities
└── types/               # Type definitions
```

## 🛠 Setup and Development

1. Make sure you have Deno installed
2. Clone the repository
3. Copy `.env.example` to `.env` and update the values:
   ```bash
   cp .env.example .env
   ```
4. Run the development server:
   ```bash
   deno run --allow-net --allow-env main.ts
   ```

## ⚠️ Important Notes

- Data is stored in-memory and will be lost on server restart
- Concurrent request handling requires careful consideration
- Phase transitions are managed through Deno's timer functionality
- Comprehensive error handling and validation is implemented
- Test coverage includes unit tests and integration tests

## 🔄 Current State

- Basic authentication system
- Game management features
- Core game logic implementation
- In-memory state management
- RESTful API endpoints

## 🚧 Future Enhancements

1. Database integration (MongoDB/PostgreSQL)
2. WebSocket support for real-time communication
3. Frontend client development
4. Additional role implementations
5. Detailed game event logging

## 📝 API Documentation

For detailed API documentation, please refer to the `openapi.yaml` file in the repository.

## 🧪 Testing

To run tests:

```bash
deno test -A
```

## � Developer Handoff

For the current development state, decisions, recent changes, known failures, and prioritized next steps, see:

- docs/handoff-summary.md

## �📄 License

[MIT]
