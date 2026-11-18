import {
  ShieldCheck,
  Database,
  ReceiptText,
  Landmark,
  BookOpen,
  Check,
  ExternalLink,
} from "lucide-react";
import { useStore } from "../store";
import { SectionHead, Badge } from "../components/ui";
import { dateTime } from "../lib";
import { browserDemo } from "../config";
export default function Settings() {
  const { data } = useStore();
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>О приложении</h1>
          <p>Возможности MVP и подготовка к работе магазина.</p>
        </div>
        <Badge tone="green">Версия 0.1.0</Badge>
      </div>
      <div className="settings-grid">
        <section className="panel">
          <SectionHead
            title="Рабочее пространство"
            action={<Database size={21} />}
          />
          <dl className="settings-list">
            <div>
              <dt>Название</dt>
              <dd>Флорист Маркет</dd>
            </div>
            <div>
              <dt>Режим</dt>
              <dd>
                <Badge tone="amber">Учебный</Badge>
              </dd>
            </div>
            <div>
              <dt>Место хранения</dt>
              <dd>Основной склад</dd>
            </div>
            <div>
              <dt>Валюта</dt>
              <dd>Российский рубль</dd>
            </div>
            <div>
              <dt>Часовой пояс</dt>
              <dd>Москва · UTC+3</dd>
            </div>
            <div>
              <dt>Данные</dt>
              <dd>
                {browserDemo
                  ? "В этом браузере (IndexedDB)"
                  : "SQLite на этом компьютере"}
              </dd>
            </div>
            <div>
              <dt>Доступ</dt>
              <dd>
                {browserDemo
                  ? "Личная копия демоданных"
                  : "Локальный, один управляющий"}
              </dd>
            </div>
          </dl>
          <p className="panel-description">
            {browserDemo
              ? "Операции сохраняются после обновления страницы. У каждого браузера своя база: между телефоном и компьютером данные не синхронизируются. Очистка данных сайта удалит изменения. Используйте только тестовые данные."
              : "Операции сохраняются после обновления страницы и перезапуска сервера. Резервное копирование и перенос описаны в README проекта."}
          </p>
        </section>
        <section className="panel">
          <SectionHead
            title="Онлайн-касса"
            action={<ReceiptText size={21} />}
          />
          <div className="integration-state">
            <span className="integration-icon">
              <ReceiptText size={27} />
            </span>
            <div>
              <h3>ККТ не подключена</h3>
              <p>Продажи и возвраты — учебные</p>
            </div>
            <Badge tone="amber">Демо</Badge>
          </div>
          <p className="panel-description">
            Для реальных расчётов нужны зарегистрированная ККТ, фискальный
            накопитель, настройка ОФД и совместимого формата фискальных
            документов. Применимость исключений проверяется отдельно.
          </p>
          <ul className="checklist">
            <li>
              <Check size={16} />
              Открытие и закрытие учебной смены
            </li>
            <li>
              <Check size={16} />
              Проверка ограничения 24 часа
            </li>
            <li>
              <Check size={16} />
              Возврат по исходной цене и способу оплаты
            </li>
            <li className="muted">
              Фискализация, коррекция и ОФД — следующий этап
            </li>
          </ul>
          <a
            className="text-link"
            href="https://kkt-online.nalog.ru/"
            target="_blank"
            rel="noreferrer"
          >
            Материалы ФНС по ККТ <ExternalLink size={14} />
          </a>
        </section>
        <section className="panel">
          <SectionHead
            title="Бухгалтерия и налоги"
            action={<Landmark size={21} />}
          />
          <p className="panel-description">
            Реализован управленческий учёт: себестоимость, поступления, расходы,
            долги, отчёты о результате и движении денег.
          </p>
          <div className="notice amber">
            Регламентированного бухгалтерского учёта и расчёта налогов в MVP
            нет.
          </div>
          <ul className="plain-list">
            <li>
              Нужны реквизиты организации, налоговый режим и применимые ставки
              НДС.
            </li>
            <li>
              Нужны первичные документы, регистры, учётная политика и интеграция
              с бухгалтерской системой.
            </li>
            <li>
              В 2026 году основная ставка НДС — 22%; применимость ставки и
              освобождения определяется по конкретному бизнесу.
            </li>
            <li>Надпись «Учебный документ» не заменяет кассовый чек.</li>
          </ul>
          <a
            className="text-link"
            href="https://www.nalog.gov.ru/rn91/ifns/ifns4/info/16599728/"
            target="_blank"
            rel="noreferrer"
          >
            ФНС: изменения НДС в 2026 году <ExternalLink size={14} />
          </a>
        </section>
        <section className="panel">
          <SectionHead
            title="Надёжность данных"
            action={<ShieldCheck size={21} />}
          />
          <ul className="checklist">
            <li>
              <Check size={16} />
              Все части операции сохраняются вместе
            </li>
            <li>
              <Check size={16} />
              Защита от повторного проведения
            </li>
            <li>
              <Check size={16} />
              Запрет отрицательных остатков
            </li>
            <li>
              <Check size={16} />
              Снимки себестоимости и спецификаций
            </li>
            <li>
              <Check size={16} />
              Журнал действий управляющего
            </li>
          </ul>
          <p className="panel-description">
            {browserDemo
              ? "Это публичная демонстрация интерфейса и бизнес-операций без общего сервера и реальных платежей. Для работы магазина необходимы защищённый сервер, роли, резервные копии и интеграция ККТ."
              : "Перед доступом через интернет необходимы авторизация, роли, HTTPS, резервное копирование, мониторинг и проверка обработки персональных данных. Текущая версия предназначена для локального использования."}
          </p>
        </section>
      </div>
      <section className="panel section-space">
        <SectionHead
          title="Журнал действий"
          description="Последние 50 событий · локальный управляющий"
          action={<BookOpen size={19} />}
        />
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Дата и время</th>
                <th>Действие</th>
                <th>Описание</th>
              </tr>
            </thead>
            <tbody>
              {data.audit.slice(0, 50).map((a) => (
                <tr key={a.id}>
                  <td>{dateTime(a.createdAt)}</td>
                  <td>
                    <b>{a.action}</b>
                  </td>
                  <td>{a.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
