/**
 * Card Builder 测试
 */

const { CardBuilder } = require('../src/core/card-builder');

describe('CardBuilder', () => {
  let builder;

  beforeEach(() => {
    builder = new CardBuilder();
  });

  test('should build markdown card', () => {
    const card = builder.buildMarkdownCard('Hello **world**');
    
    expect(card).toHaveProperty('config');
    expect(card.config).toHaveProperty('wide_screen_mode', true);
    expect(card.elements).toHaveLength(1);
    expect(card.elements[0]).toHaveProperty('tag', 'markdown');
  });

  test('should build reasoning card with content', () => {
    const card = builder.buildReasoningCard(
      '思考过程',
      '回复内容',
      1500,
      2000,
      false,
      false,
      'glm-5',
      95
    );

    expect(card).toHaveProperty('config');
    expect(card.elements.length).toBeGreaterThan(0);
  });

  test('should build reasoning card while generating', () => {
    const card = builder.buildReasoningCard(
      null,
      '',
      null,
      1000,
      false,
      true,
      'glm-5'
    );

    expect(card).toHaveProperty('config');
  });

  test('should handle empty content', () => {
    const card = builder.buildReasoningCard(
      null,
      null,
      null,
      null,
      false,
      false
    );

    expect(card.elements[card.elements.length - 1].content).toBe('(空响应)');
  });
});