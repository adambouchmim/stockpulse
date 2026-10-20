import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MarqueeText } from "@/components/MarqueeText";

describe("MarqueeText", () => {
  it("renders the text correctly", () => {
    render(<MarqueeText text="Apple Inc." />);
    expect(screen.getByText("Apple Inc.")).toBeInTheDocument();
  });

  it("sets the title attribute for accessibility and desktop tooltip", () => {
    const { container } = render(<MarqueeText text="Berkshire Hathaway Inc." />);
    expect(container.firstChild).toHaveAttribute("title", "Berkshire Hathaway Inc.");
  });

  it("applies custom className", () => {
    render(<MarqueeText text="Tesla Inc." className="font-bold text-sm" />);
    const span = screen.getByText("Tesla Inc.");
    expect(span).toHaveClass("font-bold");
    expect(span).toHaveClass("text-sm");
  });

  it("applies custom containerClassName", () => {
    const { container } = render(
      <MarqueeText text="Financial Services" containerClassName="flex-1 min-w-0" />
    );
    expect(container.firstChild).toHaveClass("flex-1");
    expect(container.firstChild).toHaveClass("min-w-0");
  });
});
