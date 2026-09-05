const MINUTE = 1000 * 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const YEAR = 365 * DAY;

const token = "uzssknJJVfRIbiUE8iaDaiE5auphHvd2"
const tableId = 1173862
const url = `https://api.baserow.io/api/database/rows/table/${tableId}/?user_field_names=true&order_by=Date`
fetch(url, {
    method: "GET",
    headers: {
        "Content-Type": "application/json",
        "Authorization": `Token ${token}`
    }
})
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        console.log(data);
        const wrapper = document.getElementById("timeline");
        const scrollable = document.createElement("div");
        scrollable.style.padding = "2.5%";
        scrollable.style.fontSize = "12px";
        scrollable.className = "scrollable";
        scrollable.style.overflowX = 'auto';
        scrollable.style.overflowY = 'hidden';
        scrollable.style.gap = '2%';
        scrollable.style.display = "flex";
        scrollable.style.flexDirection = "row";
        const css = document.styleSheets[0];
        const results = data.results;
        const now = new Date();
        let idx = 0;
        results.forEach(result => {
            const result_date = new Date(result["Date"]);
            if ((result_date.getTime() + 8 * HOUR) <= now.getTime())
                return;
            const event_div = document.createElement("div");
            event_div.innerHTML = `
              <span style="flex: 1 1 auto; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                ${result['Event Name']}
              </span>
              <span style="white-space: nowrap; background-color: gray; border-radius: 5px; padding: 2px; margin: 2px">
                <i class="fa-solid fa-location-dot" style="vertical-align: middle; position: relative; top: -3px;"></i> 
                ${result['Location']}
              </span>
            `;
            const img = document.createElement("img");
            if (result['Image URL'] == null || result['Image URL'].length === 0)
                img.src = "Carousel Image Backup.jpg";
            else
                img.src = result['Image URL'];
            const img_wrapper = document.createElement("div");
            img.style.objectFit = "cover";
            img.style.width = "100%";
            img.style.height = "100%";
            img.loading = "eager";
            img_wrapper.append(img);
            img_wrapper.style.position= "relative";
            const event_description = document.createElement("div");
            event_description.id = "event_des" + `${idx}`;
            event_description.innerHTML = result['Description'];
            img_wrapper.appendChild(event_description);
            img_wrapper.id = "event" + `${idx}`;
            event_div.appendChild(img_wrapper);
            event_div.style.display= "flex";
            event_div.flexDirection = "row";
            event_div.style.flexWrap = "wrap";
            event_div.style.justifyContent = "space-between";
            event_div.style.alignItems="center";
            event_div.style.flex = "0 0 40%";
            event_div.style.width = "100px";
            event_div.style.position = "relative";
            event_div.className = "event_div";
            const date_time = document.createElement("div");
            const date = new Date(result['Date']);
            const date_str = date.toLocaleDateString("en-GB");
            const time_str = date.toLocaleTimeString();
            date_time.className = "event_div";
            date_time.innerHTML = `
              <span style="flex: 1 1 auto; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                ${date_str}
              </span>
              <span style="white-space: nowrap; background-color: gray; border-radius: 5px; padding: 2px; margin: 2px">
                <i class="fa-solid fa-location-dot" style="vertical-align: middle; position: relative; top: -2px;"></i> 
                ${time_str}
              </span>`
            event_div.appendChild(date_time);
            scrollable.appendChild(event_div);

            const rule1 = `#event_des${idx} {
                position: absolute;
                top: calc(${event_div.style.fontSize} + 1%);
                font-size: calc(${event_div.style.fontSize} * 0.75);
                left: 50%;
                width: 50%
                max-height: 100%;
                background: rgba(29, 106, 154, 0.72);
                display: inline-block;
                color: #fff;
                visibility: hidden;
                opacity: 0;
                transition: opacity .2s, visibility .2s;
                }`
            const rule2 = `#event${idx}:hover #event_des${idx} {
                  visibility: visible;
                  opacity: 0.8;
                }`
            css.insertRule(rule1, css.cssRules.length);
            css.insertRule(rule2, css.cssRules.length);
            idx++;
        })
        scrollable.style.scrollbarGutter = "none";
        scrollable.style.scrollbarColor = "#000077 #bada55";
        scrollable.style.scrollbehavior = "smooth";
        const leftBtn = document.createElement("button");
        const iconL = document.createElement("i");
        iconL.className = "fa-solid fa-chevron-left";
        leftBtn.appendChild(iconL);
        leftBtn.style.fontSize = "30px";
        leftBtn.style.borderRadius = "50%";
        leftBtn.style.width = "40px";
        leftBtn.style.height = "40px";
        leftBtn.style.position = "absolute";
        leftBtn.style.left = '25%';
        leftBtn.style.top = '55%';
        leftBtn.style.zIndex = "2";
        leftBtn.style.opacity = "0.45";
        leftBtn.style.padding = "0";
        leftBtn.onclick = () => {scrollable.scrollBy({left: -(scrollable.clientWidth * 0.33), behavior:"smooth"})};
        const RightBtn = document.createElement("button");
        const iconR = document.createElement("i");
        iconR.className = "fa-solid fa-chevron-right";
        RightBtn.appendChild(iconR);
        RightBtn.style.borderRadius = "50%";
        RightBtn.style.padding = "0";
        RightBtn.style.fontSize = "30px";
        RightBtn.style.width = "40px";
        RightBtn.style.height = "40px";
        RightBtn.style.position = "absolute";
        RightBtn.style.left = 'calc(75% - 40px)';
        RightBtn.style.top = '55%';
        RightBtn.style.zIndex = "2";
        RightBtn.style.opacity = "0.45";
        RightBtn.onclick = () => {scrollable.scrollBy({left: (scrollable.clientWidth * 0.33), behavior:"smooth"})};
        wrapper.appendChild(leftBtn);
        wrapper.appendChild(RightBtn);
        wrapper.appendChild(scrollable);
        console.log(css);
        console.log(results);
    })
    .catch(error => console.error("Error:", error))