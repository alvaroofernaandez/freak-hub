// Package api is the inbound HTTP adapter: it maps routes onto the domain
// services and translates domain errors into the shared JSON error envelope.
// It holds no business rules of its own.
package api

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"

	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/auth"
	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/invitations"
	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/platform/httpx"
	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/users"
)

// Deps are the collaborators the HTTP layer needs.
type Deps struct {
	Users          *users.Service
	Invitations    *invitations.Service
	Verifier       auth.Verifier
	AllowedOrigins []string
	// Webhooks is optional: without it the Clerk webhook route is not mounted,
	// which is what the router tests rely on.
	Webhooks http.Handler
}

// NewRouter wires every route of the API.
func NewRouter(deps Deps) http.Handler {
	handlers := &handlers{users: deps.Users, invitations: deps.Invitations}

	router := chi.NewRouter()
	router.Use(middleware.RequestID)
	// middleware.RealIP is deliberately absent: it rewrites RemoteAddr from
	// spoofable headers (GHSA-3fxj-6jh8-hvhx). Nothing here needs the client IP,
	// and a lie in the logs is worse than no value at all.
	router.Use(middleware.Recoverer)
	router.Use(middleware.Timeout(30 * time.Second))
	router.Use(cors.Handler(cors.Options{
		AllowedOrigins:   deps.AllowedOrigins,
		AllowedMethods:   []string{http.MethodGet, http.MethodPost, http.MethodPatch, http.MethodDelete, http.MethodOptions},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		AllowCredentials: false,
		MaxAge:           300,
	}))

	router.NotFound(func(w http.ResponseWriter, _ *http.Request) {
		httpx.WriteError(w, http.StatusNotFound, httpx.CodeNotFound, "Ruta no encontrada.")
	})
	router.MethodNotAllowed(func(w http.ResponseWriter, _ *http.Request) {
		httpx.WriteError(w, http.StatusMethodNotAllowed, httpx.CodeBadRequest, "Método no permitido.")
	})

	router.Get("/healthz", handlers.health)

	if deps.Webhooks != nil {
		// Webhooks authenticate with a Svix signature, never with a session.
		router.Method(http.MethodPost, "/webhooks/clerk", deps.Webhooks)
	}

	router.Route("/v1", func(r chi.Router) {
		r.Use(auth.Middleware(deps.Verifier))

		r.Get("/me", handlers.me)
		r.Post("/invitations", handlers.createInvitation)
		r.Get("/invitations", handlers.listInvitations)
	})

	return router
}
