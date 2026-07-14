import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import Button from "./Button";

test("Button renders children correctly", () => {
  render(<Button>Click me</Button>);
  expect(screen.getByRole("button", { name: /click me/i })).toBeInTheDocument();
});

test("Button triggers onClick handler when clicked", () => {
  const handleClick = vi.fn();
  render(<Button onClick={handleClick}>Click me</Button>);
  
  fireEvent.click(screen.getByRole("button", { name: /click me/i }));
  expect(handleClick).toHaveBeenCalledTimes(1);
});

test("Button displays loading spinner and is disabled when isLoading is true", () => {
  const handleClick = vi.fn();
  render(<Button isLoading={true} onClick={handleClick}>Submit</Button>);
  
  const button = screen.getByRole("button");
  expect(button).toBeDisabled();
  expect(button.querySelector("svg.animate-spin")).toBeInTheDocument();
  
  fireEvent.click(button);
  expect(handleClick).not.toHaveBeenCalled();
});

test("Button passes through additional HTML button attributes", () => {
  render(<Button type="submit" disabled>Submit</Button>);
  const button = screen.getByRole("button", { name: /submit/i });
  expect(button).toHaveAttribute("type", "submit");
  expect(button).toBeDisabled();
});
