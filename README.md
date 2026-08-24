# MLB Combo AI

Build the entire app from this specification.

APP NAME:

Pro Baseball Combos

PURPOSE:

A mobile-first MLB analytics app that evaluates available MLB betting markets and ranks statistical combinations by model probability and estimated value.

CRITICAL RULE:

NEVER invent live MLB games, players, odds, statistics, injuries, lineups, or sportsbook data.

If live data isn't connected, display DEMO MODE clearly.

Never present demo data as live data.

Never call a pick guaranteed or a lock.

TECH STACK:

- React

- TypeScript

- Vite

- Tailwind CSS

- Component-based architecture

- Responsive/mobile-first design

- Server-side API layer for future sportsbook/API integrations

- Environment variables for API keys

- Never expose API keys in frontend code

MOBILE REQUIREMENTS:

The entire application must work on an iPhone using ONLY tapping and scrolling.

Every feature must be accessible through:

- tap

- vertical scrolling

- horizontal scrolling where necessary

Never require:

- mouse

- hover

- right click

- keyboard

- desktop-only controls

Prevent horizontal page overflow.

Use large touch targets.

Keep bottom navigation fixed but never let it cover content.

Add sufficient bottom padding so the final card can always be fully scrolled into view.

APP NAVIGATION:

BOTTOM NAVIGATION:

🏠 Home

⚾ Games

🔥 Combos

📊 Stats

⚙️ Settings

HOME:

Header:

PRO BASEBALL COMBOS

MLB ANALYTICS

Show:

- Current date

- Data status

- Last successful update

- Refresh button

If live data is unavailable:

Show a highly visible:

DEMO MODE

LIVE DATA NOT CONNECTED

Dashboard sections:

🛡️ SAFE

Highest model probability combinations.

🔥 SMART

Best balance between probability and price.

💰 VALUE

Largest positive difference between model probability and implied probability.

🚀 AGGRESSIVE

Higher-risk combinations with potentially higher payout.

Each combo card must show:

- Number of legs

- Each selection

- Market

- Odds if available

- Model probability

- Implied probability

- Estimated edge

- Confidence score 0–100

- Risk category

Make the entire card tappable.

When tapped:

Open a Combo Details screen.

COMBO DETAILS:

Show:

Combo name

Risk level

Confidence

Number of legs

For each leg:

Player/team

Market

Line

Odds

Model probability

Implied probability

Estimated edge

Add expandable:

"Why this pick?"

Show available factors:

- Season stats

- Recent performance

- Starting pitcher matchup

- Handedness

- Home/away

- Ballpark

- Weather

- Injury status

- Lineup status

- Sample size

- Data freshness

Show:

MODEL SCORE

0–100

Explain:

"This is a model confidence score, not a guarantee."

Add:

Back button

GAMES:

Display today's MLB games.

Each game card:

- Away team

- Home team

- Start time

- Game status

- Starting pitchers

- Data freshness

Tap a game to open Game Details.

GAME DETAILS:

Show:

- Teams

- Starting pitchers

- Available markets

- Player props

- Relevant statistics

- Lineup status

- Weather when available

Do not show unavailable data as if it exists.

COMBOS:

Add filter buttons:

ALL

SAFE

SMART

VALUE

AGGRESSIVE

Also allow:

2 LEGS

3 LEGS

4 LEGS

5+ LEGS

Filters should open as mobile-friendly controls.

Make filter buttons horizontally scrollable if needed.

Each result must be tappable.

STATS:

Create player/team analytics cards.

Show available:

- Season stats

- Last 5

- Last 10

- Home/away

- Platoon splits

- Opponent matchup

- Recent trend

Make cards expandable.

SETTINGS:

Settings must be completely usable by tapping.

Include:

Risk preference:

SAFE

BALANCED

AGGRESSIVE

Minimum confidence:

slider from 50–95

Preferred number of legs:

2

3

4

5+

Preferred sportsbook:

dropdown

Timezone:

automatic device timezone

Refresh interval:

Manual

5 minutes

15 minutes

30 minutes

Data mode:

LIVE

DEMO

If LIVE is selected but APIs aren't connected:

show:

"Live data isn't connected yet."

Never silently fall back to fake live information.

DATA ARCHITECTURE:

Create types/interfaces/models for:

Team

Player

Game

Pitcher

Lineup

Market

Odds

PlayerStatistics

Projection

Pick

Combo

DataUpdate

GAME:

id

date

startTime

homeTeam

awayTeam

status

homePitcher

awayPitcher

venue

weather

lineupStatus

dataUpdatedAt

PLAYER:

id

name

team

position

bats

status

MARKET:

id

gameId

playerId

marketType

line

odds

sportsbook

updatedAt

STATISTICS:

playerId

season

last5

last10

home

away

vsLeft

vsRight

opponent

sampleSize

updatedAt

PICK:

id

marketId

probability

impliedProbability

edge

confidence

risk

reasoning

dataQuality

updatedAt

COMBO:

id

name

risk

legs

combinedOdds

modelProbability

confidence

estimatedEdge

reasoning

createdAt

MODEL:

Build the scoring engine as a separate module.

For every available market:

1. Validate data.

2. Check player/team status.

3. Check lineup status.

4. Check starting pitcher status.

5. Check sample size.

6. Calculate statistical projection.

7. Estimate probability.

8. Convert odds to implied probability.

9. Calculate edge.

10. Calculate confidence.

11. Rank picks.

12. Build combinations.

Factors should include:

Season performance

Recent performance

Starting pitcher matchup

Batter handedness

Pitcher handedness

Home/away

Ballpark

Weather

Opponent

Injuries

Confirmed lineup

Market line

Odds

Implied probability

Model probability

Sample size

Data freshness

DATA QUALITY:

Give every pick a data-quality status:

HIGH

MEDIUM

LOW

Do not recommend LOW-quality picks.

COMBO BUILDING:

Do not blindly combine the highest-ranked picks.

Consider:

- individual probability

- edge

- correlation

- market type

- data quality

- sample size

Avoid overly correlated legs unless the model intentionally supports the correlation.

Require every leg to pass a minimum confidence threshold.

If there aren't enough quality picks:

show:

"Not enough qualifying data to build this combo."

Do NOT manufacture additional picks.

API ARCHITECTURE:

Create separate server-side services/interfaces for:

MLB schedule

MLB statistics

Starting pitchers

Lineups

Injuries

Odds

Player props

Weather

Do not hard-code API keys.

Use environment variables.

Create clear API error handling.

Show:

Loading

Success

No data

API error

Retry

DATA REFRESH:

When Refresh is tapped:

1. Show loading state.

2. Fetch current available data.

3. Validate response.

4. Update timestamps.

5. Recalculate model.

6. Rebuild combos.

7. Display results.

Prevent duplicate simultaneous refresh requests.

DEMO MODE:

Create a clearly labeled DEMO MODE for testing the interface.

Demo data must be obviously fictional/sample data.

Use names like:

Demo Player

Demo Team A

Demo Team B

Never make fictional data look like real current MLB information.

VISUAL DESIGN:

Dark background.

Modern premium sports analytics appearance.

Green primary accent.

Cards with rounded corners.

Clear typography.

Strong visual hierarchy.

Confidence indicators.

Risk labels.

Touch-friendly buttons.

Mobile-first spacing.

Use subtle animations.

No clutter.

HOME SCREEN EXAMPLE STRUCTURE:

------------------------------------------------

PRO BASEBALL COMBOS

MLB ANALYTICS

[ DEMO MODE ]

Today's Board

15 Games

Updated: ---

[ ↻ REFRESH ]

[ 🛡️ SAFE ]

[ 🔥 SMART ]

[ 💰 VALUE ]

[ 🚀 AGGRESSIVE ]

BEST COMBO

3 LEGS

Confidence

84 / 100

LEG 1

Selection

Model probability

Odds

LEG 2

Selection

Model probability

Odds

LEG 3

Selection

Model probability

Odds

[ VIEW DETAILS ]

------------------------------------------------

MOBILE INTERACTION:

Every button must have a working action.

Every card that looks clickable must be clickable.

Every screen must have navigation.

Every detail screen must have a Back button.

Filters must work.

Refresh must work.

Settings must work.

Bottom navigation must work.

Scrolling must work.

Expandable sections must work.

Loading states must work.

Error states must have Retry.

Empty states must explain what is happening.

Test the app at approximately:

390px wide

844px tall

before considering the mobile UI complete.

ACCESSIBILITY:

Use readable font sizes.

Use sufficient contrast.

Buttons must have accessible labels.

Do not rely only on color to communicate risk.

FINAL BUILD CHECK:

Before finishing:

1. Run the application.

2. Fix all compilation errors.

3. Fix all runtime errors.

4. Test every navigation button.

5. Test every filter.

6. Test Refresh.

7. Test Settings.

8. Test Combo Details.

9. Test Game Details.

10. Test scrolling.

11. Test mobile layout.

12. Test loading state.

13. Test API error state.

14. Test empty state.

15. Verify no fake data is labeled LIVE.

16. Verify API secrets are not exposed.

17. Verify the app works with zero API data.

18. Verify DEMO MODE is clearly visible.

MOST IMPORTANT:

The final product must be usable entirely from an iPhone through tapping and scrolling.

Do not leave dead buttons, placeholder navigation, broken screens, fake live data, or controls that require a computer.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/76282432-89b6-4f0f-a76b-f7be77d02291).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
