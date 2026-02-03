type ImageAsset = { type: "image"; key: string; url: string };
type SpritesheetAsset = {
  type: "spritesheet";
  key: string;
  url: string;
  frameWidth: number;
  frameHeight: number;
};

export type AssetDef = ImageAsset | SpritesheetAsset;

export const ASSETS: AssetDef[] = [
  {
    type: "image",
    key: "space_bg",
    url: "/assets/kenney/space-shooter/Backgrounds/darkPurple.png",
  },
  {
    type: "image",
    key: "ship_player_1",
    url: "/assets/kenney/space-shooter-redux/PNG/playerShip1_blue.png",
  },
  {
    type: "image",
    key: "ship_player_2",
    url: "/assets/kenney/space-shooter-redux/PNG/playerShip2_green.png",
  },
  {
    type: "image",
    key: "ship_player_3",
    url: "/assets/kenney/space-shooter-redux/PNG/playerShip3_red.png",
  },
  {
    type: "image",
    key: "meteor_big",
    url: "/assets/kenney/space-shooter/PNG/Meteors/meteorBrown_big1.png",
  },
  {
    type: "image",
    key: "meteor_small",
    url: "/assets/kenney/space-shooter/PNG/Meteors/meteorBrown_small1.png",
  },
  {
    type: "image",
    key: "meteor_grey_big",
    url: "/assets/kenney/space-shooter/PNG/Meteors/meteorGrey_big1.png",
  },
  {
    type: "image",
    key: "meteor_grey_small",
    url: "/assets/kenney/space-shooter/PNG/Meteors/meteorGrey_small1.png",
  },
  {
    type: "image",
    key: "pickup_scrap",
    url: "/assets/kenney/space-shooter-redux/PNG/Power-ups/bolt_bronze.png",
  },
  {
    type: "image",
    key: "pickup_tokens",
    url: "/assets/kenney/space-shooter-redux/PNG/Power-ups/star_gold.png",
  },
  {
    type: "image",
    key: "laser_blue",
    url: "/assets/kenney/space-shooter/PNG/Lasers/laserBlue07.png",
  },
  {
    type: "spritesheet",
    key: "mob_keeper19",
    url: "/assets/mobs/keeper-2/waechter-19/waechter-19/sv_waechter-19.png",
    frameWidth: 192,
    frameHeight: 64,
  },
  {
    type: "spritesheet",
    key: "mob_keeper20",
    url: "/assets/mobs/keeper-2/waechter-20/waechter-20/waechter-20 SV_Battler.png",
    frameWidth: 192,
    frameHeight: 128,
  },
  {
    type: "image",
    key: "enemy_blue_1",
    url: "/assets/kenney/space-shooter-redux/PNG/Enemies/enemyBlue1.png",
  },
  {
    type: "image",
    key: "enemy_red_2",
    url: "/assets/kenney/space-shooter-redux/PNG/Enemies/enemyRed2.png",
  },
  {
    type: "image",
    key: "enemy_green_3",
    url: "/assets/kenney/space-shooter-redux/PNG/Enemies/enemyGreen3.png",
  },
  {
    type: "image",
    key: "enemy_black_4",
    url: "/assets/kenney/space-shooter-redux/PNG/Enemies/enemyBlack4.png",
  },
  {
    type: "image",
    key: "enemy_alt_blue",
    url: "/assets/kenney/space-shooter/PNG/Enemies/enemyBlue4.png",
  },
  {
    type: "image",
    key: "enemy_alt_red",
    url: "/assets/kenney/space-shooter/PNG/Enemies/enemyRed4.png",
  },
  {
    type: "image",
    key: "enemy_alt_green",
    url: "/assets/kenney/space-shooter/PNG/Enemies/enemyGreen4.png",
  },
  {
    type: "image",
    key: "enemy_alt_black",
    url: "/assets/kenney/space-shooter/PNG/Enemies/enemyBlack4.png",
  },
  {
    type: "image",
    key: "black_hole_1",
    url: "/assets/kenney/space-shooter/PNG/Effects/star1.png",
  },
  {
    type: "image",
    key: "black_hole_2",
    url: "/assets/kenney/space-shooter/PNG/Effects/star2.png",
  },
  {
    type: "image",
    key: "black_hole_3",
    url: "/assets/kenney/space-shooter/PNG/Effects/star3.png",
  },
];
