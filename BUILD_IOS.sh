#!/bin/bash
# ═══════════════════════════════════════════════════════
# On Call — iOS BUILD SCRIPT
# Run on Mac: bash BUILD_IOS.sh
# ═══════════════════════════════════════════════════════
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo ""
echo "═══════════════════════════════════════════"
echo "  📞 On Call — iOS Build"
echo "  Bundle: com.oncall.app"
echo "═══════════════════════════════════════════"
echo ""

# Check Xcode
echo -e "${YELLOW}Checking Xcode...${NC}"
if ! command -v xcodebuild &> /dev/null; then
    echo -e "${RED}ERROR: Xcode not found. Install from App Store.${NC}"
    exit 1
fi
XCODE_VER=$(xcodebuild -version | head -1)
echo -e "${GREEN}✅ $XCODE_VER${NC}"

# Check Node
echo -e "${YELLOW}Checking Node.js...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}ERROR: Node.js not found. Install from nodejs.org${NC}"
    exit 1
fi
NODE_VER=$(node --version)
echo -e "${GREEN}✅ Node $NODE_VER${NC}"

# Install dependencies
echo ""
echo -e "${YELLOW}Installing npm dependencies...${NC}"
npm install
echo -e "${GREEN}✅ Dependencies installed${NC}"

# Build web assets
echo ""
echo -e "${YELLOW}Building web assets...${NC}"
npm run build
echo -e "${GREEN}✅ Web build complete${NC}"

# Sync Capacitor
echo ""
echo -e "${YELLOW}Syncing Capacitor...${NC}"
npx cap sync ios
echo -e "${GREEN}✅ Capacitor synced${NC}"

-e 

# Open Xcode
echo ""
echo -e "${YELLOW}Opening Xcode...${NC}"
npx cap open ios

echo ""
echo "═══════════════════════════════════════════"
echo -e "  ${GREEN}✅ BUILD COMPLETE${NC}"
echo ""
echo "  Next steps in Xcode:"
echo "  1. Select your Apple Developer team"
echo "  2. Product → Archive"
echo "  3. Distribute App → App Store Connect"
echo "  4. Upload"
echo ""
echo "  Deadline: April 28, 2026 (iOS 26 SDK)"
echo "═══════════════════════════════════════════"
