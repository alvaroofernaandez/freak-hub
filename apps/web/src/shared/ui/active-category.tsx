"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useState } from "react";
import { type CategoryId, CategoryStripe } from "./category-stripe";

type ActiveCategoryContextValue = {
  activeCategory: CategoryId | undefined;
  setActiveCategory: (category: CategoryId | undefined) => void;
};

const ActiveCategoryContext = createContext<ActiveCategoryContextValue>({
  activeCategory: undefined,
  setActiveCategory: () => {},
});

/** Holds which category is active so pages nested anywhere below can declare it. */
export function ActiveCategoryProvider({ children }: { children: ReactNode }) {
  const [activeCategory, setActiveCategory] = useState<CategoryId>();

  return (
    <ActiveCategoryContext.Provider
      value={{ activeCategory, setActiveCategory }}
    >
      {children}
    </ActiveCategoryContext.Provider>
  );
}

/** Renders the shared moldura fed by whichever page declared itself active. */
export function CategoryStripeHost() {
  const { activeCategory } = useContext(ActiveCategoryContext);
  return <CategoryStripe activeCategory={activeCategory} />;
}

type SetActiveCategoryProps = { category: CategoryId };

/**
 * Rendered by a page to widen its segment on the shared stripe. Renders
 * nothing visible; falls back to a no-op outside a provider so pages can
 * still be unit-tested in isolation (docs/testing.md).
 */
export function SetActiveCategory({ category }: SetActiveCategoryProps) {
  const { setActiveCategory } = useContext(ActiveCategoryContext);

  useEffect(() => {
    setActiveCategory(category);
    return () => setActiveCategory(undefined);
  }, [category, setActiveCategory]);

  return <span data-testid="active-category" data-category={category} hidden />;
}
