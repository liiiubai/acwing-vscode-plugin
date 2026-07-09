/*
 * @Author: richard 
 * @Date: 2022-11-17 14:56:56 
 * @Last Modified by: richard
 * @Last Modified time: 2022-11-17 16:19:51
 */
import { Disposable, workspace, ConfigurationChangeEvent, ConfigurationTarget, commands, window } from "vscode";
import { Problem, ProblemState } from './Problem'
import { ProblemContent } from './ProblemContent';
import { Course } from './Course';
import { CourseSection } from './CourseSection';
import fetch, { Headers } from 'node-fetch';
import * as cheerio from 'cheerio';
import * as WebSocket from 'ws';

const DEFAULT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
class AcwingManager implements Disposable {
  private explorerProblemsMap: Map<number, Problem[]> = new Map<number, Problem[]>();
  private problemContentMap: Map<string, ProblemContent> = new Map<string, ProblemContent>();
  private courseCache: Map<string, CourseSection[]> = new Map<string, CourseSection[]>();
  private courseListCache: Course[] | undefined;
  private maxPage = 0;
  private acWingCookie: string = "";
  private configurationChangeListener: Disposable;

  constructor() {
    this.acWingCookie = workspace.getConfiguration().get<string>("acWing.cookies", '');
    this.configurationChangeListener = workspace.onDidChangeConfiguration((event: ConfigurationChangeEvent) => {
        if (event.affectsConfiguration("acWing.cookies")) {
          let cookie = workspace.getConfiguration().get<string>("acWing.cookies", '');
          cookie = cookie.trim();
          this.acWingCookie = cookie;
          console.log('onDidChangeConfiguration()', this.acWingCookie);
          commands.executeCommand("acWing.refreshEntry", `AcWing`);    
        }
    }, this);
  }

  public async refreshCache(): Promise<void> {
    this.explorerProblemsMap.clear();
    this.problemContentMap.clear();
  }

  public async getProblemsByPage(page: number, force: boolean = false): Promise<Problem[] | undefined> {
    let items = this.explorerProblemsMap.get(page);
    if (!items || items.length == 0 || force) {
      items = await this.listProblems(page);
    }
    return items;
  }

  public async getProblemContentById(id: string, force: boolean = false): Promise<ProblemContent | undefined> {
    let item: ProblemContent | undefined = this.problemContentMap.get(id);
    if (!item || force) {
      item  = await this.fetchProblemContent(id);
    }
    return item;
  }

  public getMaxPage (): number {
    return this.maxPage;
  }

  public isLogin (): boolean {
    return !!this.acWingCookie;
  }

  public getCookie (): string {
    return this.acWingCookie;
  }

  public setCookie (val: string) {
    console.log('setCookie()', val);
    workspace.getConfiguration().update("acWing.cookies", val, ConfigurationTarget.Global);
    this.acWingCookie = val;
  }

  public dispose(): void {
    this.explorerProblemsMap.clear();
    this.problemContentMap.clear();
    this.clearCourseCache();
    this.configurationChangeListener.dispose();
  }

  public clearCache(): void {
    this.explorerProblemsMap.clear();
    this.problemContentMap.clear();
    this.clearCourseCache();
  }

  // 获取课程列表
  public async fetchCourses(force: boolean = false): Promise<Course[]> {
    if (this.courseListCache && !force) {
      return this.courseListCache;
    }

    try {
      const response = await fetch('https://www.acwing.com/activity/', {
        method: 'get',
        headers: { 'user-agent': DEFAULT_UA }
      });
      const html = await response.text();
      this.courseListCache = this.parseCourses(html);
      return this.courseListCache;
    } catch (error) {
      if (error instanceof Error) {
        console.error('fetchCourses error: ', error.message);
      }
    }
    return [];
  }

  private parseCourses(html: string): Course[] {
    if (!html) return [];
    const $ = cheerio.load(html);
    const courses: Course[] = [];
    $('a[href*="/activity/content/"]').each(function() {
      const href = $(this).attr('href') || "";
      const match = href.match(/\/activity\/content\/(\d+)/);
      if (!match) return;

      const course = new Course();
      course.id = match[1];
      course.name = $('.activity_title', this).first().text().trim();
      course.description = $('.activity_abstract', this).text().trim();

      if (course.name) {
        courses.push(course);
      }
    });
    return courses;
  }

  // 获取课程下的题目（从打卡页面获取）
  public async fetchCourseProblems(courseId: string, force: boolean = false): Promise<CourseSection[]> {
    const cached = this.courseCache.get(courseId);
    if (cached && !force) {
      return cached;
    }

    try {
      const response = await fetch(`https://www.acwing.com/activity/content/punch_the_clock/${courseId}/`, {
        method: 'get',
        headers: {
          'user-agent': DEFAULT_UA,
          'Cookie': this.acWingCookie
        }
      });
      const html = await response.text();
      const sections = this.parseCourseProblems(html);
      this.courseCache.set(courseId, sections);
      return sections;
    } catch (error) {
      if (error instanceof Error) {
        console.error('fetchCourseProblems error: ', error.message);
      }
    }
    return [];
  }

  private parseCourseProblems(html: string): CourseSection[] {
    if (!html) return [];
    const $ = cheerio.load(html);
    const sections: CourseSection[] = [];

    // .panel-week 包含 week_title，其兄弟 #week_panel_* 包含题目
    $('.panel-week').each(function(index) {
      const weekTitle = $('.week_title', this).first().text().trim();
      if (!weekTitle) return;

      const section = new CourseSection();
      section.name = weekTitle;
      section.id = `${index}`;

      // 找到对应的 week_panel（下一个兄弟元素或通过 ID 关联）
      const panelId = $(this).attr('id');
      if (panelId) {
        const panelSelector = '#' + panelId.replace('week_', 'week_panel_');
        const panel = $(panelSelector);

        // 每个 row 对应一个知识点分组
        panel.find('.row').each(function() {
          const dayName = $('.dayname', this).first().text().trim();
          // punch-line 题目在同一行内
          $('.punch-line', this).each(function() {
            const link = $('.clock-problem-title', this);
            const name = link.text().trim();
            const href = link.attr('href') || '';
            // 从 href 提取活动题目 ID
            const hrefMatch = href.match(/\/problem\/content\/(\d+)/);
            // 从 "AcWing 905. 区间选点" 格式中提取显示编号和名称
            const nameMatch = name.match(/^AcWing\s+(\d+)\.\s*(.*)/);
            if (nameMatch) {
              const problem = new Problem();
              problem.id = nameMatch[1];
              problem.index = nameMatch[1];
              problem.name = nameMatch[2];
              problem.source = dayName;
              if (hrefMatch) {
                problem.activityProblemId = hrefMatch[1];
              }
              section.problems.push(problem);
            }
          });
        });
      }

      sections.push(section);
    });

    return sections;
  }

  public clearCourseCache(): void {
    this.courseCache.clear();
    this.courseListCache = undefined;
  }

  // 从课程活动题目页面解析真实的题库数据库 ID
  public async resolveActivityProblemId(activityId: string): Promise<string | null> {
    try {
      const response = await fetch(`https://www.acwing.com/activity/content/problem/content/${activityId}/`, {
        method: 'get',
        headers: { 'user-agent': DEFAULT_UA, 'Cookie': this.acWingCookie }
      });
      const html = await response.text();
      const $ = cheerio.load(html);
      // 从"原题链接"中提取数据库 ID，如 /problem/content/907/
      let dbId: string | null = null;
      $('a').each(function() {
        if ($(this).text().trim() === '原题链接') {
          const href = $(this).attr('href') || '';
          const match = href.match(/\/problem\/content\/(\d+)/);
          if (match) { dbId = match[1]; }
        }
      });
      if (dbId) console.log('resolveActivityProblemId:', activityId, '->', dbId);
      return dbId;
    } catch (error) {
      if (error instanceof Error) {
        console.error('resolveActivityProblemId error: ', error.message);
      }
      return null;
    }
  }

  // 搜索题目 https://www.acwing.com/problem/search/1/?search_content=keyword
  public async searchProblems(keyword: string): Promise<Problem[]> {
    console.log('searchProblems() ' + keyword);

    try {
      let config = {
        method: 'get',
        headers: {
          'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
          'user-agent': DEFAULT_UA,
          'Cookie': this.acWingCookie
        }
      }
      const response = await fetch(`https://www.acwing.com/problem/search/1/?search_content=${encodeURIComponent(keyword)}`, config);

      if (response.status === 302) {
        return [];
      }

      const html = await response.text();
      return this.parseProblems(html);
    } catch (error) {
      if (error instanceof Error) {
        console.error('searchProblems error: ', error.message);
      }
    }
    return [];
  }

  // 列出acwing 页面的问题 https://www.acwing.com/problem/{page}/
  public async listProblems(page: number): Promise<Problem[]> {
    console.log('listProblems() ' + page);

    try {
      let config = {
        method: 'get',
        headers: {
          'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
          'user-agent': DEFAULT_UA,
          'Cookie': this.acWingCookie
        }
      }
      const response = await fetch(`https://www.acwing.com/problem/${page}/`, config);
      const html = await response.text();
      let items = this.parseProblems(html);
      if (items && items.length > 0) {
        this.explorerProblemsMap.set(page, items);
      }
      return items;
    } catch (error) {
      if (error instanceof Error) {
        console.error('error message: ', error.message);
      } else {
        console.error('unexpected error: ', error);
      }
    }
    return [];
  }

  private parseProblems(html: string): Problem[] {
    if (!html) {
      return [];
    }
    const $ = cheerio.load(html);
    let nodes: Problem[] = [];
    $('tbody tr').each(function (index, value) {
      let node = new Problem();

      $('td', this).each(function (i, v) {
        switch(i) {
          case 0:
            let text = $(this).html() || "";
            if (text.indexOf("已通过这道题目") >= 0) {
              node.state = ProblemState.ACCEPTED;
            } else if (text.indexOf("尝试过") >= 0) {
              node.state = ProblemState.TRY;
            }
            break;
          case 1:
            node.index = $(this).text().trim();
            break;
          case 2:
            node.name = $(this).text().trim();
            node.id = $('a', this).attr('href') || "";
            let i = node.id.lastIndexOf('/', node.id.length - 2);
            node.id = node.id.substring(i + 1, node.id.length - 1);
            break;
          case 3:
            node.source = $(this).text().trim();
            break;
          case 4:
            // 算法标签（新增列，忽略）
            break;
          case 5:
            node.passRate = $(this).text().trim();
            break;
          case 6:
            node.difficulty = $(this).text().trim();
            break;       
        }
      });
      nodes.push(node);
    });
    // 最后一页
    const that = this;
    $('.pagination li').each(function (index, value) {
      if ($(this).text().trim() === '»') {
        let text = $('a', this).attr('href') || "";
        text = text.substring('/problem/'.length, text.length - 1);
        that.maxPage = parseInt(text) || 0;
      }
      // »
    });
    return nodes;
  }

  // 获取问题的内容
  public async fetchProblemContent (id: string): Promise<ProblemContent| undefined> {
    console.log('getProblemContent() ' + id);

    try {
      let config = {
        method: 'get',
        redirect: 'manual' as const,
        headers: {
          'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
          'user-agent': DEFAULT_UA,
          'Cookie': this.acWingCookie
        }
      }

      let response = await fetch(`https://www.acwing.com/problem/content/description/${id}/`, config);
      
      // 处理重定向（Cookie 过期时会 302 到 403 页面）
      if (response.status === 302 || response.status === 301) {
        const location = response.headers.get('location') || '';
        if (location.includes('/403/') || location.includes('/login')) {
          window.showErrorMessage('Cookie 已过期，请重新设置 AcWing Cookie', '设置Cookie').then(val => {
            if (val) { commands.executeCommand('acWing.setCookie'); }
          });
          return undefined;
        }
        // 跟随其他重定向
        const redirectUrl = new URL(location, 'https://www.acwing.com').href;
        const followConfig = {
          method: 'get' as const,
          redirect: 'follow' as const,
          headers: {
            'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
            'user-agent': DEFAULT_UA,
            'Cookie': this.acWingCookie
          }
        };
        response = await fetch(redirectUrl, followConfig);
      }

      if (!response.ok) {
        console.error('fetchProblemContent() status:', response.status);
        return undefined;
      }

      const html = await response.text();
      let item = this.parseProblemContent(id, html);
      if (item && item.name) {
        this.problemContentMap.set(id, item);
      }
      return item;
    } catch (error) {
      if (error instanceof Error) {
        console.error('error message: ', error.message);
      } else {
        console.error('unexpected error: ', error);
      }
    }
    return Promise.resolve(undefined);
  }

  private parseProblemContent(id: string, html: string): ProblemContent | undefined {
    if (!html) return undefined;

    let item = new ProblemContent(id);
    const $ = cheerio.load(html);
    item.name = $('.problem-content-title').text().replace(/\n/g, '').trim();
    item.contentHtml = $('.main-martor-content').html() || "";
    // 解决图片无法显示的问题
    item.contentHtml = item.contentHtml.replace(new RegExp('src="\/media\/article\/', 'g'), 
      'src="https://www.acwing.com/media/article/');
    
    $('.table-responsive tbody tr').each(function (index, value) {
      let vd: string[] = [];
      switch (index) {
        case 0:
          // 难度
          item.difficulty = $('td span', this).text().trim();
          break;
        case 1:
          // 时空限制
          item.limit = $('td span', this).text().trim();
          break;
        case 2:
          // 通过
          item.accepted = $('td span', this).text().trim();
          break;
        case 3:
          // 未通过
          item.submissions = $('td span', this).text().trim();
          break;
        case 4:
          // 来源
          item.source = $('td span', this).text().trim();
          break;
        case 5:
          // 标签
          item.tags = [];
          let str = $('td', this).html() || "";
          let i = str.indexOf('keywords = "');
          let i2 = str.indexOf('".replace');
          if (i > 0 && i2 > 0 && i2 > i) {
            str = str.substring(i + 'keywords = "'.length, i2);
            if (str) {
              item.tags = str.split(',');
            }
          }
          break;
        default:
          console.log('parseProblemContent() error.');
      }
    });
    // 样例
    item.codeStdin = $('#run-code-stdin').text();
    // 从题目描述中解析输入样例和输出样例
    $('.main-martor-content h4').each(function() {
      const h4Text = $(this).text().trim();
      const nextPre = $(this).next('pre');
      if (nextPre.length === 0) return;
      const sampleText = nextPre.find('code').text() || nextPre.text();
      if (h4Text.includes('输入样例')) {
        if (!item.codeStdin.trim()) {
          item.codeStdin = sampleText.trim();
        }
      } else if (h4Text.includes('输出样例')) {
        item.codeStdout = sampleText.trim();
      }
    });

    // 解析代码模板
    let codeToolHtml: string = $('#code_tool_bar').html() || "";
    item.codeTemplate = this.parseCodeTemplate(codeToolHtml);
    console.log('parseProblemContent() ' + id, item);
    return item;
  }

  private parseCodeTemplate(codeToolHtml: string): object | undefined {
    if (!codeToolHtml) {
      return undefined;
    }

    const keyword = 'let problem_code_show_mappings = '
    let i1 = codeToolHtml.indexOf(keyword);
    if (i1 < 0) {
      return undefined;
    }
    let i2 = codeToolHtml.indexOf('</script>', i1 + keyword.length);
    if (i2 < 0) {
      return undefined;
    }
    try {
      let data = codeToolHtml.substring(i1 + keyword.length, i2);
      console.log('codeToolTemplate 1111 => ', data);

      let i3 = data.lastIndexOf("}");
      data = data.substring(0, i3 + 1);
      console.log('codeToolTemplate html => ', data);
      var obj = (0, eval)('(' + data + ')');
      return obj;
    } catch(e) {
      console.error(e);
    }
    return undefined;
  }
}

export const acwingManager: AcwingManager = new AcwingManager();
