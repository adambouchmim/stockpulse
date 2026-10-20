import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import BrandLogo, { BRAND_NAME, BRAND_MOTTO } from "@/components/BrandLogo";

describe("BrandLogo", () => {
  it("renders lowercase brand name and logo image with light/dark classes", () => {
    render(
      <MemoryRouter>
        <BrandLogo size="sm" />
      </MemoryRouter>
    );

    const title = screen.getByText(BRAND_NAME);
    expect(title).toBeInTheDocument();
    expect(title).toHaveClass("font-bold", "lowercase", "text-foreground");

    const logoImg = screen.getByRole("img", { name: `${BRAND_NAME} logo` });
    expect(logoImg).toBeInTheDocument();
    expect(logoImg).toHaveClass("invert", "dark:invert-0");
  });

  it("displays motto inline when showMotto and mottoPlacement='inline' are set", () => {
    render(
      <MemoryRouter>
        <BrandLogo size="sm" showMotto mottoPlacement="inline" />
      </MemoryRouter>
    );

    const motto = screen.getByText(BRAND_MOTTO);
    expect(motto).toBeInTheDocument();
    expect(motto).toHaveClass("hidden", "xl:inline-block");
  });

  it("displays motto stacked on Auth screen when mottoPlacement='stacked'", () => {
    render(
      <MemoryRouter>
        <BrandLogo size="lg" showMotto mottoPlacement="stacked" asLink={false} />
      </MemoryRouter>
    );

    const logo = screen.getByRole("img", { name: `${BRAND_NAME} logo` });
    expect(logo).toHaveClass("h-20", "sm:h-24", "mx-auto");

    const title = screen.getByText(BRAND_NAME);
    expect(title).toBeInTheDocument();
    expect(title).toHaveClass("text-foreground", "text-3xl");

    expect(screen.getByText(BRAND_MOTTO)).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
