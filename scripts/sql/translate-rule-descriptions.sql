-- 把插件市场规则的英文说明改为中文（对大陆用户更友好）
UPDATE rules SET description='arXiv 学术论文搜索（预印本：物理/数学/计算机等）' WHERE npm_package='@seekall/rule-arxiv';
UPDATE rules SET description='Crossref 学术文献搜索（期刊论文 DOI 元数据）' WHERE npm_package='@seekall/rule-crossref';
UPDATE rules SET description='PubMed 生物医学文献搜索' WHERE npm_package='@seekall/rule-pubmed';
UPDATE rules SET description='arXiv 分类热门论文趋势榜' WHERE npm_package='@seekall/rule-arxiv-trending';
UPDATE rules SET description='OpenAlex 开放学术索引搜索' WHERE npm_package='@seekall/rule-openalex';
UPDATE rules SET description='Semantic Scholar 语义学者 AI 论文搜索' WHERE npm_package='@seekall/rule-semantic-scholar';
UPDATE rules SET description='GitHub 开源仓库搜索（按 Star 排序）' WHERE npm_package='@seekall/rule-github';
UPDATE rules SET description='Hacker News 黑客新闻技术讨论搜索' WHERE npm_package='@seekall/rule-hackernews';
UPDATE rules SET description='GitHub Trending 趋势榜（每日/每周热门项目）' WHERE npm_package='@seekall/rule-github-trending';
UPDATE rules SET description='Hacker News 热门排行榜' WHERE npm_package='@seekall/rule-hackernews-trending';
UPDATE rules SET description='Reddit 社区帖子搜索' WHERE npm_package='@seekall/rule-reddit';
UPDATE rules SET description='Product Hunt 新产品发现' WHERE npm_package='@seekall/rule-producthunt';
UPDATE rules SET description='TMDB 电影电视剧数据库搜索' WHERE npm_package='@seekall/rule-tmdb';
UPDATE rules SET description='OMDB 电影信息搜索（含评分）' WHERE npm_package='@seekall/rule-omdb';
UPDATE rules SET description='Last.fm 音乐搜索与推荐' WHERE npm_package='@seekall/rule-lastfm';
UPDATE rules SET description='IGDB 电子游戏数据库搜索' WHERE npm_package='@seekall/rule-igdb';
