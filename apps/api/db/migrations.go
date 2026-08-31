// Package db embeds the goose migrations so the binary can migrate the schema
// without shipping the SQL files alongside it.
package db

import "embed"

// Migrations holds every goose migration, embedded at build time.
//
//go:embed migrations/*.sql
var Migrations embed.FS
