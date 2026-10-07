// Short primers for opening families and well-known variations. Original text written for
// Agent Chess. Names (and the move lines in data/openings.json) come from the Lichess
// chess-openings dataset (CC0).
//
// FAMILIES are matched on the part of the name before ":" (with "Accepted"/"Declined" and
// ", with ..." stripped). VARIATIONS are matched by keyword anywhere in the full name.

export const FAMILIES = {
  'Sicilian Defense': {
    about: "Black answers 1.e4 with 1...c5, fighting for the d4 square from the side instead of mirroring White. It's the most popular reply to 1.e4 at every level because it creates an unbalanced game where Black plays for a win, not just equality.",
    white: 'In the Open Sicilian (2.Nf3 and 3.d4) White trades the d-pawn for the c-pawn, gets a lead in development and often attacks on the kingside, sometimes with opposite-side castling.',
    black: 'Black gets a central pawn majority and a half-open c-file. Typical plans are queenside counterplay (...b5, ...Rc8, pressure on c3) and the freeing ...d5 break.',
  },
  'French Defense': {
    about: "After 1.e4 e6 2.d4 d5 Black challenges the center at once from behind a solid pawn wall. The price is the light-squared bishop on c8, which is hemmed in by its own e6 pawn.",
    white: 'White usually gains space with e5 and attacks on the kingside, where the extra room makes it easier to bring pieces over.',
    black: 'Black strikes at the base of the pawn chain with ...c5 (and sometimes ...f6), and looks for play on the queenside. Freeing or trading the c8 bishop is a long-term goal.',
  },
  'Caro-Kann Defense': {
    about: '1.e4 c6 prepares ...d5 while keeping the c8 bishop free, unlike the French. It has a reputation for solidity: Black accepts a little less space for a sound pawn structure and few weaknesses.',
    white: 'White can grab space with e5 (Advance), open lines with an early exchange on d5, or develop classically with Nc3 and aim for a small, lasting edge.',
    black: 'Black develops the bishop to f5 or g4 before playing ...e6, then breaks with ...c5 or ...e5. Endgames tend to favor Black\'s healthy structure.',
  },
  "Queen's Gambit Declined": {
    about: "After 1.d4 d5 2.c4 e6 Black holds the d5 point instead of taking the c4 pawn. It's one of the oldest and most trusted defenses, played at world-championship level for over a century.",
    white: 'White builds pressure on d5 and the queenside, often with Bg5, e3, Rc1 and the minority attack (b4–b5) against Black\'s queenside pawns.',
    black: 'Black aims to free the position with ...c5 or ...e5 and to solve the problem of the c8 bishop, often by trading pieces to ease the slight lack of space.',
  },
  "Queen's Gambit Accepted": {
    about: '1.d4 d5 2.c4 dxc4 takes the pawn, not to keep it but to gain time and let Black play ...c5 and ...e6 freely. White usually wins the pawn back quickly.',
    white: 'White gets a strong center (e3/e4) and active pieces, and often has an isolated d-pawn to play around later.',
    black: 'Black develops quickly, strikes with ...c5, and gets an easy game if White\'s central play fizzles.',
  },
  'Slav Defense': {
    about: '1.d4 d5 2.c4 c6 supports d5 with the c-pawn, keeping the c8 bishop free to develop outside the pawn chain. It is solid but also rich in sharp lines.',
    white: 'White often prevents ...Bf5 ideas or plays for e4 to claim the center; a4 is a common move against ...b5.',
    black: 'Black can take on c4 and try to hold it with ...b5, or develop the bishop to f5/g4 and build a sturdy structure.',
  },
  'Semi-Slav Defense': {
    about: 'A mix of the Slav and the Queen\'s Gambit Declined: Black sets up pawns on c6, d5 and e6. The c8 bishop stays inside the chain, but the position is extremely resilient and full of dynamic sidelines.',
    white: 'White chooses between quiet setups (e3, Bd3) and sharp ones (Bg5 lines such as the Botvinnik and Moscow variations).',
    black: 'Black often takes on c4 and expands with ...b5, or prepares ...e5 to free the position.',
  },
  "King's Indian Defense": {
    about: 'Black lets White build a big pawn center (c4, d4, e4) and fianchettoes the bishop on g7, planning to strike back later. It leads to some of the sharpest, most double-edged positions in chess.',
    white: 'White usually closes the center with d5 and attacks on the queenside with c5 and b4.',
    black: 'Black answers with ...e5 and, after the center locks, a kingside pawn storm with ...f5, ...f4 and ...g5. Races between the two wings are typical.',
  },
  'Nimzo-Indian Defense': {
    about: '1.d4 Nf6 2.c4 e6 3.Nc3 Bb4 pins the knight that would support e4. Black controls the center with pieces rather than pawns and is often willing to give up the bishop for the knight.',
    white: 'White may get the bishop pair at the cost of doubled c-pawns, and then tries to open the position for the bishops.',
    black: 'Black aims to blockade White\'s pawns on dark squares (...c5, ...d6, ...e5) and target the doubled c-pawns.',
  },
  "Queen's Indian Defense": {
    about: 'After 1.d4 Nf6 2.c4 e6 3.Nf3 b6 Black fianchettoes the queen\'s bishop to control e4. It is a calm, flexible defense that keeps the position balanced.',
    white: 'White usually fianchettoes too (g3, Bg2) to neutralize the long diagonal and aims for a small space advantage.',
    black: 'Black fights for the e4 square with ...Bb7 and ...Ne4, often breaking with ...c5 or ...d5 later.',
  },
  'Grünfeld Defense': {
    about: 'Black plays ...g6 and ...d5, inviting White to build a big pawn center and then attacking it with pieces and ...c5. It is a dynamic, theory-heavy defense loved by attacking players.',
    white: 'White builds e4/d4 and tries to keep the center intact and use it for a kingside attack or a passed d-pawn.',
    black: 'The g7 bishop, ...c5 and ...Nc6 all hit d4. If the center cracks, Black\'s pieces spring to life.',
  },
  'English Opening': {
    about: '1.c4 controls d5 from the flank. It is flexible and often transposes into 1.d4 openings, or becomes a "reversed Sicilian" after 1...e5.',
    white: 'White typically fianchettoes (g3, Bg2), controls the light squares and expands on the queenside with b4.',
    black: 'Black can claim the center directly with ...e5, mirror with ...c5 (Symmetrical), or steer toward Indian setups.',
  },
  'Réti Opening': {
    about: 'Named after Richard Réti, a pioneer of hypermodern ideas: control the center from a distance with pieces (Nf3, g3, Bg2, c4) instead of occupying it with pawns.',
    white: 'White undermines Black\'s center with c4 and often b3/Bb2, keeping options open about d4.',
    black: 'Black can build a classical center with ...d5 and ...c6, or take the space White gives away.',
  },
  'Zukertort Opening': {
    about: '1.Nf3 develops a piece and controls e5 and d4 without committing the pawns yet. It frequently transposes into 1.d4 or 1.c4 openings.',
    white: 'White waits to see Black\'s setup, then picks the best structure: d4 systems, the English with c4, or a King\'s Indian Attack.',
    black: 'Black can pick almost any setup; ...d5 and ...Nf6 are the most common responses.',
  },
  'Catalan Opening': {
    about: 'White combines the Queen\'s Gambit (d4, c4) with a kingside fianchetto (g3, Bg2). The bishop on g2 pressures the long diagonal toward Black\'s queenside.',
    white: 'White often gives a pawn on c4 temporarily for long-term pressure on b7 and the queenside.',
    black: 'Black either takes on c4 and tries to keep it, or holds with ...c6 and ...Nbd7, aiming to free the c8 bishop.',
  },
  'Dutch Defense': {
    about: '1.d4 f5 fights for e4 with a flank pawn, steering the game into unbalanced positions. It weakens Black\'s king a little in exchange for kingside attacking chances.',
    white: 'White often fianchettoes and aims for e4 to open the center while Black\'s king is slightly exposed.',
    black: 'Black chooses between the Stonewall (...d5, ...e6, ...c6), the Leningrad (...g6) and the Classical (...e6, ...d6), often pushing on the kingside.',
  },
  'Benoni Defense': {
    about: 'Black answers 1.d4 with an early ...c5. After White plays d5, Black gets a queenside pawn majority and active pieces in exchange for less space.',
    white: 'White uses the space advantage, often pushing e4–e5 to break through in the center.',
    black: 'Black fianchettoes on g7 and plays for ...b5 on the queenside, using the half-open e-file and the long diagonal.',
  },
  'Benko Gambit': {
    about: 'After 1.d4 Nf6 2.c4 c5 3.d5 b5 Black sacrifices a pawn for long-lasting pressure on the a- and b-files. Many players think Black\'s compensation lasts well into the endgame.',
    white: 'White keeps the extra pawn, consolidates the queenside and looks for play in the center with e4–e5.',
    black: 'Black opens the a- and b-files, fianchettoes on g7, and puts rooks and queen on the queenside files.',
  },
  "King's Gambit": {
    about: '1.e4 e5 2.f4 offers a pawn to open the f-file and build a big center. It was the romantic opening of the 19th century and still leads to wild, tactical games.',
    white: 'White aims to recapture the pawn or use the f-file and fast development for a direct attack on f7.',
    black: 'Black can keep the pawn with ...g5, return it for quick development, or decline with ...Bc5 or ...d5.',
  },
  'Italian Game': {
    about: '1.e4 e5 2.Nf3 Nc6 3.Bc4 develops quickly and aims the bishop at f7, Black\'s weakest point. It ranges from slow maneuvering (Giuoco Pianissimo) to razor-sharp gambits.',
    white: 'White often builds slowly with c3 and d3 (or d4), then expands, but tactics against f7 are always in the air.',
    black: 'Black mirrors with ...Bc5 or counterattacks with ...Nf6 (Two Knights). Watch out for early Ng5 ideas against f7.',
  },
  'Ruy Lopez': {
    about: '1.e4 e5 2.Nf3 Nc6 3.Bb5 pressures the knight that defends e5. Also called the Spanish Game, it is one of the most deeply studied openings, with long-term strategic pressure rather than quick tactics.',
    white: 'White builds a strong center with c3 and d4, keeps the bishop on the a4–e8 or b3–g8 diagonal and maneuvers knights to the kingside (Nbd2–f1–g3).',
    black: 'Black usually kicks the bishop with ...a6 and ...b5, and either holds e5 solidly or counterattacks (Marshall, Open, Berlin).',
  },
  'Scotch Game': {
    about: '1.e4 e5 2.Nf3 Nc6 3.d4 opens the center immediately. It leads to open, piece-active play with fewer long theoretical lines than the Ruy Lopez.',
    white: 'After 3...exd4 4.Nxd4 White gets a central knight and space, and often aims for e5 or a kingside attack.',
    black: 'Black hits the d4 knight with ...Bc5 or ...Nf6, and looks for quick development and pressure on e4.',
  },
  "Petrov's Defense": {
    about: '1.e4 e5 2.Nf3 Nf6 counterattacks e4 instead of defending e5. Also called the Russian Game, it is famous for solidity and is a top-level drawing weapon.',
    white: 'White usually takes on e5, then chases the knight back with d4 or Qe2 and looks for a small, lasting edge.',
    black: 'Don\'t copy White blindly: after 3.Nxe5 Black must play ...d6 first, before taking on e4.',
  },
  'Four Knights Game': {
    about: 'Both sides develop both knights (Nf3, Nc3 / ...Nc6, ...Nf6). It is classical and symmetrical, a good way to learn open-game principles.',
    white: 'White can choose the Spanish (Bb5), Scotch (d4) or Italian setups from here.',
    black: 'Black can keep the symmetry, or try the sharp Rubinstein counter-gambit with ...Nd4.',
  },
  'Three Knights Opening': {
    about: 'Three knights are out and Black has delayed the fourth. It often transposes to the Four Knights Game.',
    white: 'White develops normally and watches for Black deviations like ...g6 or ...Bb4.',
    black: 'Black has extra options, such as a kingside fianchetto, without committing the g8 knight.',
  },
  'Vienna Game': {
    about: '1.e4 e5 2.Nc3 supports an early f4 push while keeping the f-pawn free. It can become the aggressive Vienna Gambit or a quiet positional game.',
    white: 'White often plays f4 to open the f-file, or Bc4 to aim at f7.',
    black: 'Black can hit e4 with ...Nf6 and the freeing ...d5, or mirror with ...Nc6.',
  },
  "Bishop's Opening": {
    about: '1.e4 e5 2.Bc4 aims at f7 right away and keeps options open about the knights and the f-pawn.',
    white: 'White can transpose to the Italian, Vienna or King\'s Gambit setups.',
    black: '...Nf6 attacks e4 at once and is the main reply.',
  },
  'Philidor Defense': {
    about: '1.e4 e5 2.Nf3 d6 defends e5 with a pawn. It is solid but a little passive, because the f8 bishop is shut in.',
    white: 'White grabs space with d4 and develops freely, often with a pleasant edge.',
    black: 'Black aims for a compact setup (...Nf6, ...Nbd7, ...Be7) and the ...c6/...b5 or ...exd4 plans.',
  },
  "King's Pawn Game": {
    about: '1.e4: White occupies the center, opens lines for the queen and the f1 bishop, and fights for d5 and f5. Most of the classical openings start here.',
    white: 'Develop quickly, control the center and castle. Fast piece play rewards you after 1.e4.',
    black: 'The main replies are 1...e5 (open games), 1...c5 (Sicilian), 1...e6 (French) and 1...c6 (Caro-Kann).',
  },
  "Queen's Pawn Game": {
    about: '1.d4 takes the center with a pawn that\'s already protected by the queen. Games are usually more positional than after 1.e4.',
    white: 'White typically follows with c4 (Queen\'s Gambit) or a system setup (London, Colle, Torre).',
    black: 'Black can meet it classically with ...d5, or with the Indian defenses (...Nf6 followed by ...g6 or ...e6).',
  },
  'Indian Defense': {
    about: '1.d4 Nf6 is the gateway to the "Indian" defenses, where Black controls the center with pieces and often fianchettoes a bishop.',
    white: 'White usually plays c4 to take more space, or a system like the London or Trompowsky.',
    black: 'From here Black chooses between the King\'s Indian, Nimzo, Queen\'s Indian, Grünfeld, Benoni and others.',
  },
  'London System': {
    about: 'White sets up d4, Bf4, e3, Nf3, c3 and often Bd3 and Nbd2. It is a "system" opening that gives the same solid structure against almost any defense, which makes it popular at club level.',
    white: 'The plan is easy to learn: develop, castle, and later go for a kingside attack (Ne5, h4) or the e4 break.',
    black: 'Common ideas are ...c5 with pressure on b2/d4, ...Qb6 hitting b2, and an early ...Bd6 to trade off White\'s good bishop.',
  },
  'Colle System': {
    about: 'White sets up d4, Nf3, e3, Bd3 and then pushes e4. It is quiet at first but aims at a kingside attack.',
    white: 'White prepares e4 with Nbd2 and Re1, opening the b1–h7 diagonal toward Black\'s king.',
    black: 'Black can fianchetto, fight for e4 with ...b6 and ...Bb7, or strike with ...c5.',
  },
  'Torre Attack': {
    about: 'White plays d4, Nf3 and Bg5, pinning the knight on f6. It is a solid system with active piece play.',
    white: 'White often follows with e3, Nbd2 and c3, aiming for e4.',
    black: 'Black can play ...c5 and ...Qb6 to hit b2, or ...h6 to ask the bishop a question.',
  },
  'Trompowsky Attack': {
    about: '1.d4 Nf6 2.Bg5 attacks the knight at once and avoids mainstream theory. It leads to unbalanced games.',
    white: 'White is often happy to take on f6 and double Black\'s pawns, or follow with e3 and c3.',
    black: '...Ne4 (hitting the bishop) and ...e6 are the main replies.',
  },
  'Scandinavian Defense': {
    about: '1.e4 d5 hits the e4 pawn at once. After 2.exd5 Black usually recaptures with the queen and accepts losing a little time to it.',
    white: 'White develops with tempo by attacking the queen (Nc3) and aims for a lead in development.',
    black: 'Black puts the queen on a5 or d6, develops the c8 bishop actively and gets a solid Caro-Kann-like structure.',
  },
  'Alekhine Defense': {
    about: '1.e4 Nf6 tempts White\'s pawns forward so they can be attacked later. It is a provocative, hypermodern defense.',
    white: 'White can grab a lot of space (e5, c4, d4, f4) but must make sure the pawns don\'t become targets.',
    black: 'Black undermines the pawn center with ...d6, ...c5 or ...f6, and plays against overextended pawns.',
  },
  'Pirc Defense': {
    about: '1.e4 d6 2.d4 Nf6 3.Nc3 g6 lets White have the center and counterattacks it later from the flanks, with the bishop on g7.',
    white: 'Aggressive setups (the Austrian Attack with f4, or Be3/Qd2/h4) aim for a kingside attack.',
    black: 'Black waits for the right moment to break with ...e5 or ...c5.',
  },
  'Modern Defense': {
    about: '1...g6 with an early ...Bg7, delaying ...Nf6. It is very flexible and lets Black react to White\'s setup.',
    white: 'White builds a broad center and decides where to attack depending on Black\'s plan.',
    black: 'Black hits the center with ...d6, ...c5 or ...e5, sometimes with queenside expansion (...a6, ...b5).',
  },
  'Nimzowitsch Defense': {
    about: '1.e4 Nc6 pressures d4 and e5 with a piece. It is offbeat and flexible.',
    white: 'White usually builds a big center with d4.',
    black: 'Black aims for ...d5 or ...e5 to challenge it, often transposing into other openings.',
  },
  'Owen Defense': {
    about: '1.e4 b6 fianchettoes the queen\'s bishop at once to hit e4. It is unusual and gives White a free hand in the center.',
    white: 'White builds d4 and protects e4 with Bd3 or Nc3.',
    black: 'Black pressures e4 with ...Bb7 and plays ...e6 and ...c5.',
  },
  'Center Game': {
    about: '1.e4 e5 2.d4 exd4 3.Qxd4 opens the center early. The queen comes out quickly and can be chased.',
    white: 'White often castles queenside and attacks.',
    black: 'Black develops with tempo (...Nc6 hits the queen) and looks for quick piece play.',
  },
  'Danish Gambit': {
    about: 'White sacrifices one or two pawns (c3 after ...exd4) for a huge lead in development and two powerful bishops.',
    white: 'White aims the bishops at f7 and g7 and attacks before Black can consolidate.',
    black: 'Black can return material with an early ...d5 to neutralize the attack.',
  },
  'Ponziani Opening': {
    about: '1.e4 e5 2.Nf3 Nc6 3.c3 prepares d4. It is an old, rare opening that avoids mainstream theory.',
    white: 'White plans d4 to build a strong center.',
    black: 'Black can counter at once with ...d5 or ...Nf6, hitting e4.',
  },
  'Latvian Gambit': {
    about: '1.e4 e5 2.Nf3 f5 is a risky counter-gambit that opens lines but weakens Black\'s king.',
    white: 'White usually takes on e5 and develops quickly, aiming for an attack.',
    black: 'Black must play energetically to justify the weaknesses.',
  },
  'Elephant Gambit': {
    about: '1.e4 e5 2.Nf3 d5 strikes back at once. It is a rare and risky way to unbalance the game.',
    white: 'White can take on d5 or e5 and should come out with a sound extra pawn or a better position.',
    black: 'Black hopes for quick development and tactical chances.',
  },
  'Englund Gambit': {
    about: '1.d4 e5 is a trappy gambit. It isn\'t sound, but it catches the unprepared.',
    white: 'White keeps the pawn and avoids the queen tricks along the a7–g1 diagonal.',
    black: 'Black looks for quick development and traps, especially with ...Qe7 and ...Qb4+.',
  },
  'Blackmar-Diemer Gambit': {
    about: '1.d4 d5 2.e4 dxe4 3.Nc3 and f3 sacrifices a pawn to open the f-file and attack.',
    white: 'White gets fast development and kingside attacking chances.',
    black: 'Black should develop solidly and return the pawn at the right moment.',
  },
  'Bird Opening': {
    about: '1.f4 controls e5 and is like a Dutch Defense with an extra move for White.',
    white: 'White often builds a kingside attack with Nf3, e3, Be2/Bd3 and sometimes b3/Bb2.',
    black: 'The From Gambit (...e5) and ...d5 setups are the main replies.',
  },
  'Polish Opening': {
    about: '1.b4 grabs queenside space and prepares Bb2. It is offbeat and aims to surprise.',
    white: 'White develops the bishop to b2 and plays on the queenside.',
    black: 'Black can attack the b4 pawn (with ...e5 and ...Bxb4) or simply take the center.',
  },
  'Nimzo-Larsen Attack': {
    about: '1.b3 fianchettoes the queen\'s bishop at once to control e5 and d4 from afar.',
    white: 'White develops flexibly and lets Black build a center to attack it later.',
    black: 'Black can build a broad center with ...e5 and ...d5.',
  },
  "King's Indian Attack": {
    about: 'White sets up Nf3, g3, Bg2, O-O, d3 and often e4, a reversed King\'s Indian that works against many defenses.',
    white: 'White often plays e5 and attacks on the kingside, especially against French-type setups.',
    black: 'Black usually takes queenside space with ...c5 and ...b5.',
  },
  'Grob Opening': {
    about: '1.g4 is a provocative opening that weakens White\'s kingside to fianchetto the bishop quickly.',
    white: 'White pressures b7 and d5 with Bg2.',
    black: 'Black can take the center with ...d5 and attack the g4 pawn.',
  },
  'Hungarian Opening': {
    about: '1.g3 prepares a kingside fianchetto, a flexible hypermodern start.',
    white: 'White often transposes into English or King\'s Indian Attack setups.',
    black: 'Black can occupy the center with ...d5 and ...e5.',
  },
  'Van Geet Opening': {
    about: '1.Nc3 develops a knight and supports e4. It is flexible and rare.',
    white: 'White often follows with e4 or d4, transposing into other openings.',
    black: 'Black can take the center with ...d5 or ...e5.',
  },
  'Bogo-Indian Defense': {
    about: '1.d4 Nf6 2.c4 e6 3.Nf3 Bb4+ is a solid way to avoid some Queen\'s Gambit lines.',
    white: 'White blocks the check with Bd2 or Nbd2 and keeps a slight space edge.',
    black: 'Black often trades the dark-squared bishop and plays on the dark squares.',
  },
  'Old Indian Defense': {
    about: 'Black plays ...Nf6, ...d6 and ...e5, a solid but less dynamic cousin of the King\'s Indian.',
    white: 'White grabs space and aims for queenside play.',
    black: 'Black develops the bishop to e7 and aims for ...e5 breaks.',
  },
  'Tarrasch Defense': {
    about: '1.d4 d5 2.c4 e6 3.Nc3 c5: Black accepts an isolated d-pawn for free piece play.',
    white: 'White blockades the isolated pawn and pressures it, often with a kingside fianchetto.',
    black: 'Black uses open lines and active pieces, and the d-pawn can become a strength.',
  },
  'Neo-Grünfeld Defense': {
    about: 'A Grünfeld setup where White has played g3 and Bg2. It is less sharp but still dynamic.',
    white: 'White aims for a solid center and pressure along the long diagonal.',
    black: 'Black counters with ...c5 and pressure on d4.',
  },
  'Kangaroo Defense': {
    about: 'An early ...Bb4+ against 1.d4 e6 2.c4. It is flexible and often transposes into the Bogo-Indian.',
    white: 'White blocks the check and develops normally.',
    black: 'Black aims for dark-square control.',
  },
  'English Defense': {
    about: 'Black plays ...e6 and ...b6 with an early ...Bb7 against d4 and c4.',
    white: 'White takes the center with e4 and must watch the pressure on e4.',
    black: 'Black pressures e4 and looks for ...f5 or ...Qh4 ideas.',
  },
  'Rat Defense': {
    about: 'An early ...d6 against 1.d4 or 1.e4. It is flexible but passive.',
    white: 'White grabs the center.',
    black: 'Black waits and chooses between Pirc, Philidor or Old Indian setups.',
  },
  'Pterodactyl Defense': {
    about: 'Black fianchettoes the bishop on g7 and plays ...c5, often with ...Qa5, putting early pressure on the dark squares.',
    white: 'White builds the center and develops quickly.',
    black: 'Black pressures c3 and d4.',
  },
  'Mieses Opening': {
    about: '1.d3 is a quiet, flexible first move.',
    white: 'White often reaches a reversed Pirc or King\'s Indian Attack.',
    black: 'Black can take the center freely.',
  },
  "Van't Kruijs Opening": {
    about: '1.e3 is a modest move that keeps options open, a reversed French setup.',
    white: 'White often transposes into Queen\'s Pawn or English lines.',
    black: 'Black can take the center freely.',
  },
};

// Notes for famous variations, matched by keyword anywhere in the full opening name.
export const VARIATIONS = [
  { match: 'Sicilian Defense: Najdorf', text: '...a6 in the Open Sicilian: a flexible move that stops Bb5 and Nb5 and prepares ...e5 or ...e6 and ...b5. It\'s one of the most analysed lines in chess.' },
  { match: 'Sicilian Defense: Accelerated Dragon', text: 'Black plays ...g6 before ...d6, keeping the option of ...d5 in one move and avoiding some of White\'s sharpest attacks.' },
  { match: 'Sicilian Defense: Dragon', text: 'Black fianchettoes the bishop on g7, where it bears down the long diagonal. Against the Yugoslav Attack (Be3, Qd2, f3, O-O-O) both sides race to attack the other\'s king.' },
  { match: 'Sicilian Defense: Alapin', text: '2.c3 prepares d4 so that White can recapture with a pawn and keep a full center. It\'s a solid way to avoid the Open Sicilian.' },
  { match: 'Sicilian Defense: Smith-Morra', text: 'White gives a pawn (3.c3) for fast development and open lines. It\'s dangerous at club level if Black isn\'t careful.' },
  { match: 'Sicilian Defense: Scheveningen', text: 'Black sets up a small center with ...e6 and ...d6, solid but flexible. White often answers with the Keres Attack (g4).' },
  { match: 'Sicilian Defense: Taimanov', text: '...e6 and ...Nc6: Black keeps many setups available and aims for quick, flexible development.' },
  { match: 'Sicilian Defense: Kan Variation', text: '...e6 and ...a6: Black keeps the pieces flexible and waits to choose a setup.' },
  { match: 'Sicilian Defense: Lasker-Pelikan', text: 'Black plays ...e5, accepting a hole on d5 for active pieces and a dynamic game. The Sveshnikov is its main line.' },
  { match: 'Closed', text: 'White avoids opening the center early and keeps the tension, usually building up slowly.' },
  { match: 'Ruy Lopez: Berlin Defense', text: 'Black answers Bb5 with ...Nf6 and often reaches the "Berlin endgame", where queens come off early. It\'s famously hard to crack and is a modern top-level drawing weapon.' },
  { match: 'Ruy Lopez: Marshall Attack', text: 'Black sacrifices a pawn with ...d5 for a long-lasting kingside attack. White has to defend precisely.' },
  { match: 'Exchange Variation', text: 'An early exchange that simplifies the position. It often damages the opponent\'s pawn structure or heads for a slightly better endgame.' },
  { match: 'Italian Game: Two Knights Defense', text: '...Nf6 counterattacks e4. After 4.Ng5 the play gets sharp at once, and the famous Fried Liver Attack is one of the dangers.' },
  { match: 'Fried Liver', text: 'White sacrifices a knight on f7 to drag Black\'s king into the open. It\'s a classic trap at club level.' },
  { match: 'Evans Gambit', text: '4.b4 gives a pawn to deflect the c5 bishop and gain time for c3 and d4. It\'s a favourite of attacking players since the 1820s.' },
  { match: 'Giuoco Pianissimo', text: 'The "very quiet game": White plays c3 and d3 and builds up slowly. Modern grandmasters play it a lot for its rich maneuvering.' },
  { match: 'Giuoco Piano', text: 'The "quiet game": both bishops on c4/c5. White often plays c3 and d4 to take the center.' },
  { match: 'French Defense: Winawer', text: '3...Bb4 pins the c3 knight. After e5 and a3 the position gets very unbalanced: doubled pawns for White, but the bishop pair and attacking chances.' },
  { match: 'Advance Variation', text: 'White pushes e5 to gain space and cramp Black. Black strikes back at the pawn chain, usually with ...c5.' },
  { match: 'French Defense: Tarrasch Variation', text: '3.Nd2 avoids the pin from ...Bb4. It\'s solid and flexible, and ...c5 is a main reply.' },
  { match: 'Caro-Kann Defense: Panov', text: 'White gets an isolated d-pawn and active piece play, much like a Queen\'s Gambit.' },
  { match: "Queen's Gambit Declined: Orthodox Defense", text: 'Black develops with ...Be7, ...O-O and ...Nbd7, solid and classical, then frees the game with ...c5 or ...e5.' },
  { match: "King's Indian Defense: Sämisch", text: 'White plays f3 to support e4 and often goes for a direct kingside attack.' },
  { match: 'Budapest', text: '1.d4 Nf6 2.c4 e5 is a gambit where Black usually regains the pawn on e5 and gets active pieces.' },
  { match: 'Stonewall', text: 'Pawns on c6, d5, e6 and f5 (or the mirror for White) make a fortress. The e4 or e5 square becomes a strong outpost for a knight.' },
  { match: "King's Gambit Accepted: Muzio", text: 'White sacrifices a whole knight for a tremendous attack. It\'s one of the wildest lines in the King\'s Gambit.' },
  { match: 'Max Lange', text: 'A sharp, tactical line from the 19th century with open lines and early clashes.' },
];

// Names in the data that should share another family's primer.
const ALIASES = {
  'Vienna Gambit': 'Vienna Game',
  "King's Pawn Opening": "King's Pawn Game",
  "King's Knight Opening": "King's Pawn Game",
  'Richter-Veresov Attack': "Queen's Pawn Game",
  'Rapport-Jobava System': "Queen's Pawn Game",
};

function familyOf(name) {
  const head = name.split(':')[0].trim();
  const bare = head.replace(/, with .*$/, '').trim();
  const stripped = bare.replace(/ (Accepted|Declined)$/, '').trim();
  for (const k of [head, bare, stripped]) {
    if (FAMILIES[k]) return k;
    if (ALIASES[k]) return ALIASES[k];
  }
  return stripped;
}

export function primerFor(name) {
  if (!name) return null;
  let family = FAMILIES[familyOf(name)];
  // Systems filed under another family in the data (e.g. "Indian Defense: London System").
  if (!family) family = null;
  let system = null;
  for (const key of ['London System', 'Colle System', 'Torre Attack', 'Trompowsky Attack', 'Catalan Opening', "King's Indian Attack"]) {
    if (name.includes(key) && FAMILIES[key] && familyOf(name) !== key) { system = FAMILIES[key]; break; }
  }
  const notes = [];
  for (const v of VARIATIONS) {
    if (name.includes(v.match) && !notes.some((n) => n.match.includes(v.match) || v.match.includes(n.match))) notes.push(v);
  }
  return { family: system || family, familyName: system ? Object.keys(FAMILIES).find((k) => FAMILIES[k] === system) : familyOf(name), notes };
}
