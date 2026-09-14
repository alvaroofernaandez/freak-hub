package library

import (
	"context"
	"fmt"
	"strings"
)

// ServiceDeps are the collaborators the use cases need.
type ServiceDeps struct {
	Works WorkRepository
}

// Service holds the library use cases and the domain rules they enforce.
type Service struct {
	works WorkRepository
}

// NewService builds the library use cases from its collaborators.
func NewService(deps ServiceDeps) *Service {
	return &Service{works: deps.Works}
}

// CreateManualWork records a work no public catalogue lists.
//
// Source is stamped rather than accepted: what this creates is manual by
// definition, and letting a caller claim the record came from AniList when
// nobody checked would poison the (source, source_id) uniqueness that the
// imported works rely on to be shared. For the same reason SourceID stays
// empty — there is no external record to point at — which is also why manual
// works are not deduplicated: two members can legitimately add different
// things under the same title, and the defence against an accidental
// duplicate is searching before creating, not a unique index over nothing.
func (s *Service) CreateManualWork(ctx context.Context, input ManualWorkInput) (Work, error) {
	title, err := normaliseTitle(input.Title)
	if err != nil {
		return Work{}, err
	}

	if !input.Category.Valid() {
		return Work{}, ErrInvalidCategory
	}

	work, err := s.works.Create(ctx, Work{
		Title:    title,
		Category: input.Category,
		Source:   SourceManual,
		SourceID: "",
		CoverURL: input.CoverURL,
		Synopsis: input.Synopsis,
		Year:     input.Year,
		Metadata: input.Metadata,
	})
	if err != nil {
		return Work{}, fmt.Errorf("create manual work %q: %w", title, err)
	}

	return work, nil
}

// SearchWorks returns a page of the shared catalogue, newest first
// (ADR-0011), and the cursor for the next page, or nil when this was the last
// one.
//
// An unknown category is rejected instead of ignored: answering the
// unfiltered list would look like success while quietly showing rows the
// caller asked to hide.
func (s *Service) SearchWorks(
	ctx context.Context, filter WorkFilter, after *Cursor, limit int,
) ([]Work, *Cursor, error) {
	if limit < MinListLimit || limit > MaxListLimit {
		return nil, nil, ErrInvalidLimit
	}

	if filter.Category != "" && !filter.Category.Valid() {
		return nil, nil, ErrInvalidFilter
	}

	filter.Query = strings.TrimSpace(filter.Query)

	// Ask for one extra row: its presence, not a COUNT(*), is what tells us
	// whether another page follows (ADR-0011).
	rows, err := s.works.Search(ctx, filter, after, limit+1)
	if err != nil {
		return nil, nil, fmt.Errorf("search works: %w", err)
	}

	if len(rows) <= limit {
		return rows, nil, nil
	}

	rows = rows[:limit]
	last := rows[len(rows)-1]

	return rows, &Cursor{CreatedAt: last.CreatedAt, ID: last.ID}, nil
}

// normaliseTitle trims the title and holds it to the bounds the contract
// declares, so a title made of spaces can never reach the catalogue.
func normaliseTitle(raw string) (string, error) {
	title := strings.TrimSpace(raw)
	if len(title) < MinTitleLength || len([]rune(title)) > MaxTitleLength {
		return "", ErrInvalidTitle
	}

	return title, nil
}
