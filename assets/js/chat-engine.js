/**
 * 娅娅的对话引擎（纯函数，浏览器 / Node 共用）
 * 规则式意图匹配 + 记忆上下文；不依赖任何 AI 生成内容，台词均为站务组手写。
 */

export const MOODS = ["idle", "happy", "sleep", "cheeky", "love"];

/** 意图表：按顺序匹配，第一个命中即返回 */
export const INTENTS = [
  {
    id: "help",
    patterns: [/帮助|怎么用|能做什么|你会什么|命令|菜单/i],
    mood: "idle",
    lines: [
      "可以叫我娅娅。试试说「你好」「你是谁」「蛋糕」「等了几天」，或者告诉我你的名字；也可以直接拖我、摸我、给我贴一张图。",
      "我会的不多：陪你说话、收蛋糕、吹泡泡，还有记住你的名字。点「表情」还能收到我的一枚小表情。"
    ]
  },
  {
    id: "name-set",
    patterns: [/我叫|我的名字是|叫我|我是(?![谁哪])/i],
    mood: "happy",
    action: "remember-name",
    lines: [
      "记住啦，{name}。以后我一抬头就先找你。",
      "{name}……我把它写在泡泡内壁上了，不会破的那种。",
      "好，{name}。那今天也算有人和我一起等她了对吧。"
    ]
  },
  {
    id: "name-ask",
    patterns: [/你叫什么|你的名字|你是谁|谁是娅娅/i],
    mood: "cheeky",
    lines: [
      "我是娅娅——达妮娅的娅，也是「等一等」的娅。",
      "叫我娅娅就好。正式一点的话：泡影视阈驻本页办事员，编号Denia。",
      "名字嘛……她睡着的时候我替她值班，所以暂时叫娅娅。"
    ]
  },
  {
    id: "greet-night",
    patterns: [/晚安|睡了|睡觉/i],
    mood: "sleep",
    lines: [
      "晚安。我把泡泡调暗一点，你睡你的，我睡我的。",
      "嗯……蛋糕我收好了，梦里的份也留了。晚安。",
      "До свидания——直到下次再见。这句晚安版的意思是：明天也一起在。"
    ]
  },
  {
    id: "greet",
    patterns: [/你好|您好|嗨|hi|hello|hey|早上好|下午好|晚上好|在吗|在不在/i],
    mood: "happy",
    lines: [
      "你好呀。今天也来陪她等一会儿吗？",
      "嗨——你来了，泡泡都亮了一点。",
      "在的在的，我一直都在这一页里。",
      "你好。第 {day} 天了，谢谢你还在。"
    ]
  },
  {
    id: "cake",
    patterns: [/蛋糕|甜点|吃的|饿|喂你/i],
    mood: "love",
    action: "offer-cake",
    lines: [
      "蛋糕！……咳咳，我是说，谢谢你想着她。留一块在架子上吧，我替你看着。",
      "她喜欢草莓奶油的那一种。你留的那块，我记在第 {cakes} 格了。",
      "收到蛋糕的时候，她的睫毛会动一下，真的，我见过。"
    ]
  },
  {
    id: "day",
    patterns: [/几天|多少天|等了|计数|日子/i],
    mood: "idle",
    lines: [
      "今天是等她的第 {day} 天。数字是我一笔一笔划的，划得很慢，但没停过。",
      "第 {day} 天。不算长，也不算短，刚好够把蛋糕架擦得发亮。",
      "{day} 天了哦。每一天都有人留蛋糕，所以每一天都算数。"
    ]
  },
  {
    id: "love",
    patterns: [/喜欢|爱|想她|想您|抱抱|拥抱|亲/i],
    mood: "love",
    lines: [
      "……抱一下可以，但要轻一点，她还在睡。",
      "我也喜欢你这种人：会对着一个还没回来的人说想念的人。",
      "喜欢的话，就多留一会儿吧。等待这件事，人多就不重了。"
    ]
  },
  {
    id: "sad",
    patterns: [/难过|伤心|哭|累|烦|不开心|郁闷|压力/i],
    mood: "idle",
    lines: [
      "过来坐一下。泡泡里面很软，烦恼挤不进来。",
      "不开心的话，就先不说原因。我陪你数三下：一、二……三，好了，轮到你说。",
      "她说过类似的话：糟糕的事情比想象中还糟糕的时候，就先吃一口蛋糕。"
    ]
  },
  {
    id: "image",
    patterns: [/\[图片\]|图|照片|截图/i],
    mood: "happy",
    lines: [
      "哇……给我的吗？我把它贴在泡泡内壁了，和蛋糕收据放一起。",
      "收到！这张我要举给她看，她醒着的时候一定会眯起眼睛笑。",
      "好看。是你画的吗？画的人都很厉害，真的。"
    ]
  },
  {
    id: "sticker",
    patterns: [/表情|贴纸|stick/i],
    mood: "cheeky",
    lines: [
      "表情包里都是我，但每一枚都是别人一笔一笔画的我。要哪一枚？",
      "嘘——表情要省着用，一枚表情等于一次眨眼。"
    ]
  },
  {
    id: "bubble",
    patterns: [/泡泡|气泡|吹/i],
    mood: "cheeky",
    action: "bubble",
    lines: [
      "泡泡是这里的通用货币。吹一个试试，戳破会有小故事掉出来。",
      "我的能力叫泡影视阈——听起来很厉害，其实主要用于吹泡泡和装蛋糕。"
    ]
  },
  {
    id: "who-denia",
    patterns: [/达妮娅是谁|她是谁|丹妮娅|denia|ダーニャ/i],
    mood: "idle",
    lines: [
      "达妮娅，鸣潮里的共鸣者，星矩学院的学生，武器是一台音感仪。能力嘛……泡泡和告别。",
      "她是一个把「再见」说得很轻的人。轻到我们都愿意等她回来再说一次。",
      "官方设定里她被编程成容器，可在这里她只是睡在泡泡里、等人留蛋糕的那个人。"
    ]
  },
  {
    id: "goodbye",
    patterns: [/再见|拜拜|bye|走了|下线|回头见|до свидания|dasvidaniya/i],
    mood: "idle",
    lines: [
      "До свидания——直到下次再见。我哪也不去，就在这一页。",
      "好，我帮你把椅子推回去。路上慢一点。",
      "再见不是结束哦，是「下次见」的意思。她教的。"
    ]
  },
  {
    id: "thanks",
    patterns: [/谢谢|感谢|辛苦/i],
    mood: "happy",
    lines: ["不客气。你来了就是帮大忙了。", "谢什么呀，蛋糕架本来就该有人擦。"],
  },
  {
    id: "joke",
    patterns: [/笑话|讲个|好笑|逗我/i],
    mood: "cheeky",
    lines: [
      "问：泡泡为什么不会迷路？答：因为它总是跟着吹它的人走。……冷吗？冷就对了，我是熔融属性里最凉的那一个。",
      "我今天练习了 49 次眨眼，只为在日报里看起来精神一点。结果日报截的是我睡觉的那张。",
      "黑猫玩偶说它不寂寞。它缝的嘴，说了也不算。"
    ]
  }
];

/** 无命中时的闲话 */
export const IDLE_CHATTER = [
  "嗯嗯，我在听。你继续说，我边擦蛋糕架边听。",
  "这句话我要记在小本子上，等她醒了念给她听。",
  "风把泡泡吹歪了一点……没关系，歪的泡泡也装得住话。",
  "我眨了一下眼，算回应过了哦。",
  "再说一点嘛。等待的时间里有声音，就不算空等。",
  "唔……我不太懂这个，但我不介意多听一遍。"
];

export function pick(arr, rnd = Math.random) {
  return arr[Math.floor(rnd() * arr.length)];
}

/**
 * @param {string} text 用户输入
 * @param {{name?:string, day?:number, cakes?:number, remembered?:string[]}} ctx 上下文
 * @returns {{intent:string, text:string, mood:string, action?:string}}
 */
export function extractName(text = "") {
  const m = String(text).match(/(?:我叫|叫我|我的名字是|我是)\s*([\u4e00-\u9fa5A-Za-z0-9_·]{1,12})/);
  return m ? m[1] : "";
}

export function reply(text = "", ctx = {}) {
  const clean = String(text).trim();
  for (const intent of INTENTS) {
    if (intent.patterns.some((re) => re.test(clean))) {
      if (intent.action === "remember-name") {
        const n = extractName(clean);
        if (n) ctx = { ...ctx, name: n };
      }
      let line = pick(intent.lines);
      line = line
        .replaceAll("{name}", ctx.name || "你")
        .replaceAll("{day}", String(ctx.day ?? 0))
        .replaceAll("{cakes}", String(ctx.cakes ?? 0));
      return { intent: intent.id, text: line, mood: intent.mood, action: intent.action };
    }
  }
  return { intent: "chatter", text: pick(IDLE_CHATTER), mood: "idle" };
}

/** 摸头 / 喂蛋糕 / 戳泡泡等动作的即时反应 */
export const REACTIONS = {
  pet: [
    "唔……再摸一下。",
    "头发要乱了啦，但我不介意。",
    "你手心的温度，我替她记下了。",
    "嘿嘿。",
    "摸头会被加成好感度的哦，已经加上了。"
  ],
  cake: [
    "草莓奶油！她的那份我放枕头边了。",
    "第 {cakes} 块蛋糕，入账。",
    "你放蛋糕的样子很轻，她一定会喜欢。",
    "蛋糕架又满了一格，谢谢谢谢你。"
  ],
  poke: ["咿！", "泡泡差点破了啦。", "戳我做什么，我正在值班。", "……吓一跳，尾巴翘起来了。"],
  drop: ["咻——落地请轻一点，我在里面。", "被搬家的感觉……还不错，这个角度能看到门口。"],
  bubblePop: ["破了一个！掉出来的是：", "戳得好准。里面有字：", "泡泡碎了会变成小星星，和一句："],
  sleepWake: ["唔……嗯？我醒了，我没睡，我只是闭眼整理回忆。", "早……蛋糕架没倒，我可以继续睡吗。"],
  image: [
    "哇，是给我的图吗？我贴到泡泡内壁上了！",
    "收到收到……这张好暖，我举给她看一下。",
    "图我收好了，和蛋糕收据放在一起，都是贵重物品。"
  ]
};
