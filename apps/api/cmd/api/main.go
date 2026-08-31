// Command api is the composition root: it reads the configuration, builds the
// adapters, injects them into the domain services and serves HTTP. All wiring
// lives here so no other package has to know how the pieces fit together.
package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	clerkclient "github.com/clerk/clerk-sdk-go/v2"
	"github.com/clerk/clerk-sdk-go/v2/invitation"

	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/api"
	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/config"
	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/invitations"
	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/platform/clerkadapter"
	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/platform/postgres"
	svixadapter "github.com/alvaroofernaandez/freak-hub/apps/api/internal/platform/svix"
	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/users"
	"github.com/alvaroofernaandez/freak-hub/apps/api/internal/webhooks"
)

func main() {
	if err := run(); err != nil {
		slog.Error("the api could not start", slog.Any("error", err))
		os.Exit(1)
	}
}

func run() error {
	cfg, err := config.Load(os.Getenv)
	if err != nil {
		return err
	}

	setUpLogger(cfg)

	// Signal-aware context: Ctrl+C and SIGTERM start a graceful shutdown.
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	pool, err := postgres.NewPool(ctx, cfg.DatabaseURL)
	if err != nil {
		return err
	}
	defer pool.Close()

	clerkclient.SetKey(cfg.Clerk.SecretKey)

	members := postgres.NewMemberRepository(pool)
	usersService := users.NewService(members)
	invitationsService := invitations.NewService(invitations.ServiceDeps{
		Sender:      clerkadapter.NewInvitationSender(invitation.NewClient(&clerkclient.ClientConfig{})),
		Repository:  postgres.NewInvitationRepository(pool),
		Members:     members,
		RedirectURL: signUpURL(cfg),
	})

	signature, err := svixadapter.NewVerifier(cfg.Clerk.WebhookSigningSecret)
	if err != nil {
		return err
	}

	handler := api.NewRouter(api.Deps{
		Users:          usersService,
		Invitations:    invitationsService,
		Verifier:       clerkadapter.NewVerifier(authorizedParty(cfg)),
		AllowedOrigins: cfg.AllowedOrigins,
		Webhooks: webhooks.NewClerkHandler(webhooks.ClerkDeps{
			Signature:   signature,
			Users:       usersService,
			Invitations: invitationsService,
		}),
	})

	return serve(ctx, cfg, handler)
}

func serve(ctx context.Context, cfg config.Config, handler http.Handler) error {
	server := &http.Server{
		Addr:              cfg.Addr(),
		Handler:           handler,
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       2 * time.Minute,
	}

	errs := make(chan error, 1)

	go func() {
		slog.Info("api listening",
			slog.String("addr", server.Addr), slog.String("env", cfg.Env))

		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			errs <- fmt.Errorf("listen: %w", err)
		}
	}()

	select {
	case err := <-errs:
		return err
	case <-ctx.Done():
		slog.Info("shutting down")
	}

	// Give in-flight requests a chance to finish before dropping connections.
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		return fmt.Errorf("graceful shutdown: %w", err)
	}

	return nil
}

func setUpLogger(cfg config.Config) {
	levels := map[string]slog.Level{
		"debug": slog.LevelDebug,
		"info":  slog.LevelInfo,
		"warn":  slog.LevelWarn,
		"error": slog.LevelError,
	}

	level, ok := levels[cfg.LogLevel]
	if !ok {
		level = slog.LevelInfo
	}

	options := &slog.HandlerOptions{Level: level}

	// Structured JSON in production so the VPS log collector can parse it;
	// plain text locally so it stays readable in a terminal.
	var handler slog.Handler = slog.NewTextHandler(os.Stdout, options)
	if cfg.IsProduction() {
		handler = slog.NewJSONHandler(os.Stdout, options)
	}

	slog.SetDefault(slog.New(handler))
}

// signUpURL is where Clerk sends an invitee after they click the email.
func signUpURL(cfg config.Config) string {
	return firstOrigin(cfg) + "/registro"
}

// authorizedParty is the front end allowed to mint session tokens for this API.
func authorizedParty(cfg config.Config) string {
	return firstOrigin(cfg)
}

func firstOrigin(cfg config.Config) string {
	if len(cfg.AllowedOrigins) == 0 {
		return ""
	}

	return cfg.AllowedOrigins[0]
}
