import {
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

import CatalogueImagePicker from "../components/catalogue/CatalogueImagePicker.jsx";

describe("CatalogueImagePicker", () => {
  it("moves a selected product image to primary position", () => {
    const onChange =
      vi.fn();

    render(
      <CatalogueImagePicker
        images={[
          "/products/a.jpg",
          "/products/b.jpg",
        ]}
        onChange={
          onChange
        }
        multiple
        label="Product images"
      />
    );

    fireEvent.click(
      screen.getByRole(
        "button",
        {
          name:
            "Set primary",
        }
      )
    );

    expect(
      onChange
    ).toHaveBeenCalledWith([
      "/products/b.jpg",
      "/products/a.jpg",
    ]);
  });

  it("accepts a safe app-relative URL", () => {
    const onChange =
      vi.fn();

    render(
      <CatalogueImagePicker
        images={[]}
        onChange={
          onChange
        }
        label="Service image"
      />
    );

    fireEvent.change(
      screen.getByPlaceholderText(
        "https://... or /products/..."
      ),
      {
        target: {
          value:
            "/services/cut.jpg",
        },
      }
    );

    fireEvent.click(
      screen.getByRole(
        "button",
        {
          name: "Add URL",
        }
      )
    );

    expect(
      onChange
    ).toHaveBeenCalledWith([
      "/services/cut.jpg",
    ]);
  });

  it("rejects protocol-relative URLs instead of treating them as app paths", () => {
    const onChange =
      vi.fn();

    render(
      <CatalogueImagePicker
        images={[]}
        onChange={
          onChange
        }
      />
    );

    fireEvent.change(
      screen.getByPlaceholderText(
        "https://... or /products/..."
      ),
      {
        target: {
          value:
            "//evil.example/image.jpg",
        },
      }
    );

    fireEvent.click(
      screen.getByRole(
        "button",
        {
          name: "Add URL",
        }
      )
    );

    expect(
      onChange
    ).not.toHaveBeenCalled();

    expect(
      screen.getByRole(
        "alert"
      )
    ).toHaveTextContent(
      "single slash"
    );
  });
});
