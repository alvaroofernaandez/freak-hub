// Command migrate applies the goose migrations embedded in the binary.
//
//	go run ./cmd/migrate up
//	go run ./cmd/migrate down
//	go run ./cmd/migrate status
package main

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"os"

	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"

	"github.com/alvaroofernaandez/freak-hub/apps/api/db"
)

func main() {
	if err := run(context.Background()); err != nil {
		slog.Error("migration failed", slog.Any("error", err))
		os.Exit(1)
	}
}

func run(ctx context.Context) error {
	command := "up"
	if len(os.Args) > 1 {
		command = os.Args[1]
	}

	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		return fmt.Errorf("DATABASE_URL is required")
	}

	connection, err := sql.Open("pgx", databaseURL)
	if err != nil {
		return fmt.Errorf("open database: %w", err)
	}
	defer func() {
		if closeErr := connection.Close(); closeErr != nil {
			slog.Warn("could not close the database connection", slog.Any("error", closeErr))
		}
	}()

	goose.SetBaseFS(db.Migrations)

	if err := goose.SetDialect("postgres"); err != nil {
		return fmt.Errorf("set dialect: %w", err)
	}

	if err := goose.RunContext(ctx, command, connection, "migrations", os.Args[2:]...); err != nil {
		return fmt.Errorf("run %q: %w", command, err)
	}

	return nil
}
