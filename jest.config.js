module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom', // Important for DOM interactions
  roots: ['<rootDir>/src'], // Look for tests in src
};
