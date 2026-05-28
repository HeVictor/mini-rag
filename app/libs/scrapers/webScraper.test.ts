import { cleanText } from "./webScraper";

describe("cleanText", () => {
  test("should normalise Unicode characters", () => {
    const text = "Ｈｅｌｌｏ Ｈｅｌｌｏ";

    const cleanedText = cleanText(text);

    expect(cleanedText).toBe("Hello Hello");
  });

  test("should noramlise accented characters", () => {
    const text = "café and Māori and Emily Brontë";

    const cleanedText = cleanText(text);

    expect(cleanedText).toBe("cafe and Maori and Emily Bronte");
  });

  test("should noramlise smart quotes", () => {
    const text = "“oh look at me I'm so fancy”, ‘I have cool quotes’";

    const cleanedText = cleanText(text);

    expect(cleanedText).toBe(
      "\"oh look at me I'm so fancy\", 'I have cool quotes'",
    );
  });

  test("should noramlise dashes characters", () => {
    const text = "stop — hammer time";

    const cleanedText = cleanText(text);

    expect(cleanedText).toBe("stop - hammer time");
  });

  test("should noramlise ellipsis characters", () => {
    const text = "wait… keep waiting…";

    const cleanedText = cleanText(text);

    expect(cleanedText).toBe("wait... keep waiting...");
  });

  test("should noramlise assortted spaces and line breaks", () => {
    const text = "non-breaking space,        wow, \n\n\n yay";

    const cleanedText = cleanText(text);

    expect(cleanedText).toBe("non-breaking space, wow, yay");
  });

  test("should remove boilerplate phrases", () => {
    const text =
      "blah blah blah click here wow yeah terms and conditions hohoho accept cookies";

    const cleanedText = cleanText(text);

    expect(cleanedText).toBe("blah blah blah wow yeah hohoho");
  });

  test("should normalise different things collectively in the same string", () => {
    const text = "Ｈｅｌｌｏ café…                accept cookies “NOW”";

    const cleanedText = cleanText(text);

    expect(cleanedText).toBe('Hello cafe... "NOW"');
  });
});
