module.exports = {
  collectCoverageFrom: ["src/*.ts"],
  coverageDirectory: "coverage",
  coveragePathIgnorePatterns: ["/node_modules/"],
  globals: {
    "ts-jest": {
      tsconfig: {
        target: "esnext",
        sourceMap: true
      }
    }
  },
  moduleFileExtensions: ["ts", "js"],
  moduleDirectories: ["node_modules"],
  preset: "ts-jest",
  testEnvironment: "jsdom",
  watchPathIgnorePatterns: ["/node_modules/", "/dist/", "/.git/"]
}