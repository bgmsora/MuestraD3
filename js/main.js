function create_CCS_chart() {
    ////////////////////////////////////////////////////////////// 
    ////////////////// Set-up sizes of the page //////////////////
    ////////////////////////////////////////////////////////////// 

    var container = d3.select("#chart");

    window.scroll(0, window.pageYOffset);
    //Remove anything that was still there
    container.selectAll("svg, canvas").remove();
    container.style("height", null);
    document.body.style.width = null;
    d3.selectAll(".outer-container")
        .style("width", null)
        .style("margin-left", null)
        .style("margin-right", null)
        .style("padding-left", null)
        .style("padding-right", null);

    var base_width = 1600; //tamaño 1600
    var ww = window.innerWidth, //2518 window.innerWidth
        wh = window.innerHeight; //1405 window.innerHeight
    var width_too_small = ww < 500;

    //console.log(ww)
    //console.log(wh)
    var width;
    if (wh < ww) {
        width = wh / 0.7; //0.7
    } else {
        if (ww < width_too_small) width = ww / 0.5;
        else if (ww < 600) width = ww / 0.6;
        else if (ww < 800) width = ww / 0.7;
        else if (ww < 1100) width = ww / 0.8;
        else width = ww / 0.8;
    }
    width = Math.round(Math.min(base_width - 500, width)); ///////////////////////Ajuste del tamaño////////////////////////////
    var height = width;

    //Scaling the entire visual, as compared to the base size
    var size_factor = width / base_width;

    //Adjust the general layout based on the width of the visual
    container.style("height", height + "px");
    //Reset the body width
    var annotation_padding = width_too_small ? 0 : 240 * size_factor;
    var total_chart_width = width + annotation_padding;
    var no_scrollbar_padding = total_chart_width > ww ? 0 : 20;
    if (total_chart_width > ww) document.body.style.width = total_chart_width + 'px';
    var outer_container_width = Math.min(base_width, ww - no_scrollbar_padding - 2 * 20); //2 * 20px padding
    d3.selectAll(".outer-container").style("width", outer_container_width + "px");

    //Update the sizes of the images in the introduction
    if (ww > 900) { //900
        //Adjust the sizes of the images in the intro
        for (var i = 1; i <= 2; i++) {
            var par_height = 500;
            var div_width = 500;
            if (total_chart_width > ww) var width_left = (parseInt(document.body.style.width) - div_width) / 2;
            else var width_left = (window.innerWidth - div_width) / 2 - 10;

            var max_width = par_height * 1.99;
            var window_based_width = div_width * 0.48 + width_left;
            if (window_based_width > max_width) par_height = window_based_width / 1.99;
        }
    }


    //Move the window to the top left of the text if the chart is wider than the screen
    if (total_chart_width > ww) {
        var pos = document.getElementById("top-outer-container").getBoundingClientRect();
        var scrollX = pos.left - 15;
        if (total_chart_width - ww < pos.left) {
            scrollX = (total_chart_width - ww) / 2;
        } else if (outer_container_width >= base_width) scrollX = pos.left - (parseInt(document.body.style.width) - pos.width) / 4 - 10;
        //Scroll to the new position on the horizontal
        window.scrollTo(scrollX, window.pageYOffset);

        //This doesn't work in all browsers, so check (actually it only doesn't seem to work in Chrome mobile...)
        if (Math.abs(window.scrollX - scrollX) > 2) {
            window.scrollTo(0, window.pageYOffset)
            d3.selectAll(".outer-container")
                .style("margin-left", 0 + "px") //0
                .style("margin-right", 0 + "px") //0
                .style("padding-left", 30 + "px") //30
                .style("padding-right", 30 + "px") //30
        }
    }

    document.querySelector('html').style.setProperty('--annotation-title-font-size', Math.min(14, 15 * size_factor) + 'px')
    document.querySelector('html').style.setProperty('--annotation-label-font-size', Math.min(14, 15 * size_factor) + 'px')

    ////////////////////////////////////////////////////////////// 
    //////////////////// Create SVG & Canvas /////////////////////
    ////////////////////////////////////////////////////////////// 

    //Canvas
    var canvas = container.append("canvas").attr("id", "canvas-target")
    var ctx = canvas.node().getContext("2d");
    crispyCanvas(canvas, ctx, 2);
    ctx.translate(width / 2, height / 2);
    //General canvas settings
    ctx.globalCompositeOperation = "multiply";
    ctx.lineCap = "round";
    ctx.lineWidth = 3 * size_factor;

    //SVG container
    var svg = container.append("svg")
        .attr("id", "CCS-SVG")
        .attr("width", width)
        .attr("height", height);

    var chart = svg.append("g")
        .attr("transform", "translate(" + (width / 2) + "," + (height / 2) + ")");

    var defs = chart.append("defs");

    //////////////////////////////////////////////////////////////
    //////////////// Initialize helpers and scales ///////////////
    //////////////////////////////////////////////////////////////

    var num_chapters = 50,
        num_volume = 12;
    var pi2 = 2 * Math.PI,
        pi1_2 = Math.PI / 2;

    var cover_alpha = 0.3;
    var remove_text_timer;

    var color_sakura = "#EB5580";

    //Has a mouseover just happened
    var mouse_over_in_action = false;

    //Radii at which the different parts of the visual should be created
    var rad_chapter_outer = width * 0.3499, //outside of the hidden chapter hover
        rad_chapter_donut_outer = width * 0.334, //outer radius of the chapter donut
        rad_chapter_donut_inner = width * 0.32, //inner radius of the chapter donut
        rad_chapter_inner = width * 0.30, //outside of the hidden chapter hover
        rad_dot_color = width * 0.32, //chapter dot
        rad_line_max = 0.31,
        rad_line_min = 0.215,
        rad_line_label = width * 0.29, //textual label that explains the hovers
        rad_donut_inner = width * 0.122, //inner radius of the character donut
        rad_donut_outer = width * 0.13, //outer radius of the character donut
        rad_name = rad_donut_outer + 15 * size_factor, //padding between character donut and start of the character name
        rad_image = rad_donut_inner - 4 * size_factor; //radius of the central image shown on hover
    rad_relation = rad_donut_inner - 8 * size_factor; //padding between character donut and inner lines


    ///////////////////////////////////////////////////////////////////////////
    //////////////////////////// Read in the data /////////////////////////////
    ///////////////////////////////////////////////////////////////////////////

    d3.queue()
        .defer(d3.json, "data/ccs_chapter_hierarchy.json")
        .defer(d3.json, "data/ccs_character_per_chapter.json")
        .defer(d3.json, "data/ccs_character_per_chapter_cover.json")
        .defer(d3.json, "data/ccs_character_total.json")
        //.defer(d3.json, "data/ccs_character_relations.json")//el anterior json
        .defer(d3.json, "data/css_relations.json")
        .defer(d3.json, "data/ccs_character_chapter_price.json")
        .defer(d3.json, "data/css_chapter_price.json")
        .await(draw); //price_chapter

    function draw(error, chapter_hierarchy_data, character_data, cover_data, character_total_data, relation_data, price_data, price_chapter) {

        if (error) throw error;

        ///////////////////////////////////////////////////////////////////////////
        ///////////////////////// Calculate chapter locations /////////////////////
        /////////////////////////////////////////////////////////////////////////// 

        chapter_hierarchy_data = chapter_hierarchy_data.filter(function(d) { return d.name === "CCS" || (d.volume_num <= num_volume && !d.num) || (d.num >= 1 && d.num <= num_chapters); });
        //Based on typical hierarchical clustering example
        var root = d3.stratify()
            .id(function(d) { return d.name; })
            .parentId(function(d) { return d.parent; })
            (chapter_hierarchy_data);
        var cluster = d3.cluster()
            .size([360, rad_dot_color])
            .separation(function separation(a, b) {
                return a.parent == b.parent ? 1 : 1; //1.3 separacion de los nodos del 1 al 50
            });
        cluster(root);
        var chapter_location_data = root.leaves()
        chapter_location_data.forEach(function(d, i) {
            d.centerAngle = d.x * Math.PI / 180;
        });

        //The distance between two chapters that belong to the same volume
        var chapter_angle_distance = chapter_location_data[1].centerAngle - chapter_location_data[0].centerAngle;

        //Add some useful metrics to the chapter data
        chapter_location_data.forEach(function(d, i) {
            d.startAngle = d.centerAngle - chapter_angle_distance / 2;
            d.endAngle = d.centerAngle + chapter_angle_distance / 2;
        })

        ///////////////////////////////////////////////////////////////////////////
        ///////////////////////////// Final data prep /////////////////////////////
        ///////////////////////////////////////////////////////////////////////////

        character_total_data.forEach(function(d) {
            d.num_chapters = +d.num_chapters;
        })
        var character_names = character_total_data.map(function(d) { return d.character; });

        //Sort cover data according to characters from total
        function sortCharacter(a, b) { return character_names.indexOf(a.character) - character_names.indexOf(b.character); }
        cover_data.sort(sortCharacter);
        character_data.sort(sortCharacter);


        //////////////////////////////////////////////////////////////
        /////////////// Create circle for cover image ////////////////
        //////////////////////////////////////////////////////////////

        //Adding images of the characters
        //Se basara en esta parte para poder hacer las conexiones del centro
        var image_radius = rad_image;
        var image_group = defs.append("g").attr("class", "image-group");
        var cover_image = image_group.append("pattern")
            .attr("id", "cover-image")
            .attr("class", "cover-image")
            .attr("patternUnits", "objectBoundingBox")
            .attr("height", "100%") //100
            .attr("width", "100%") //100
            .append("image")
            .attr("xlink:href", "img/white-square.jpg")
            .attr("height", 2 * image_radius)
            .attr("width", 2 * image_radius);

        ///////////////////////////////////////////////////////////////////////////
        /////////////////////// Create character donut chart //////////////////////
        /////////////////////////////////////////////////////////////////////////// 

        //Arc command for the character donut chart
        var arc = d3.arc()
            .outerRadius(rad_donut_outer + 4)
            .innerRadius(rad_donut_inner - 8)
            .padAngle(0.07)
            .cornerRadius((rad_donut_outer + 7 - rad_donut_inner) / 2 * 1)
            //Pie function to calculate sizes of donut slices
        var pie = d3.pie()
            .sort(null)
            .value(function(d) { return d.num_chapters; }); //se da el tamaño por el numero de capitulos (acomodo en el json character total)

        var arcs = pie(character_total_data);
        arcs.forEach(function(d, i) {
            d.character = character_total_data[i].character;
            d.centerAngle = (d.endAngle - d.startAngle) / 2 + d.startAngle;
        });

        //Create the donut slices per character (and the number of chapters they appeared in)
        var donut_group = chart.append("g").attr("class", "donut-group");
        var slice = donut_group.selectAll(".arc")
            .data(arcs)
            .enter().append("path")
            .attr("class", "arc")
            .attr("d", arc)
            .style("fill", function(d) { return d.data.color; });

        ///////////////////////////////////////////////////////////////////////////
        ///////////////////////////// Create name labels //////////////////////////
        /////////////////////////////////////////////////////////////////////////// 

        var hover_circle_group = chart.append("g").attr("class", "hover-circle-group");
        var name_group = chart.append("g").attr("class", "name-group");

        //Create a group per character
        var names = name_group.selectAll(".name")
            .data(arcs)
            .enter().append("g")
            .attr("class", "name")
            .style("text-anchor", function(d) { return d.centerAngle > 0 & d.centerAngle < Math.PI ? "start" : "end";; })
            .style("font-family", "Anime Ace") //tipo de letra

        //Add the big "main" name
        names.append("text")
            .attr("class", "name-label")
            .attr("id", function(d, i) { return "name-label-" + i; })
            .attr("dy", ".2em") //.35
            .attr("transform", function(d, i) {
                //If there is a last name, move the first a bit upward
                if (character_total_data[i].last_name !== "") {
                    var finalAngle = d.centerAngle + (d.centerAngle > 0 & d.centerAngle < Math.PI ? -0.02 : 0.02);
                } else {
                    var finalAngle = d.centerAngle;
                }
                return "rotate(" + (finalAngle * 180 / Math.PI - 90) + ")" +
                    "translate(" + rad_name + ")" +
                    (finalAngle > 0 & finalAngle < Math.PI ? "" : "rotate(180)");
            })
            .style("font-size", (19 * size_factor) + "px")
            .style("fill", function(d, i) {
                if (character_total_data[i].color == "#de5a44") {
                    return "#564c41";
                } else {
                    return "white";
                }
            })
            .style("font-family", 'RobotoCondReg')
            .text(function(d, i) { return character_total_data[i].first_name; });

        //Add the smaller last name (if available) below
        names.append("text")
            .attr("class", "name-label") //last-name-label
            .attr("id", function(d, i) { return "last-name-label-" + i; })
            .attr("dy", ".4em")
            .attr("transform", function(d, i) {
                //If there is a last name, move the last a bit downward
                if (character_total_data[i].last_name !== "") {
                    var finalAngle = d.centerAngle + (d.centerAngle > 0 & d.centerAngle < Math.PI ? 0.03 : -0.03);
                } else {
                    var finalAngle = d.centerAngle;
                }
                return "rotate(" + (finalAngle * 180 / Math.PI - 90) + ")" +
                    "translate(" + rad_name + ")" +
                    (finalAngle > 0 & finalAngle < Math.PI ? "" : "rotate(180)");
            })
            .style("fill", function(d, i) {
                if (character_total_data[i].color == "#de5a44") {
                    return "#564c41";
                } else {
                    return "white";
                }
            })
            .style("font-size", (19 * size_factor) + "px")
            .style("font-family", 'RobotoCondReg')
            .text(function(d, i) { return character_total_data[i].last_name; });

        //Add one more line for the classmates label
        names.filter(function(d, i) { return i === arcs.length - 1; })
            .append("text")
            .attr("class", "last-name-label")
            .attr("dy", ".35em")
            .attr("y", "1.35em")
            .attr("transform", function(d, i) {
                var finalAngle = (d.endAngle - d.startAngle) / 2 + d.startAngle - 0.03;
                return "rotate(" + (finalAngle * 180 / Math.PI - 90) + ")" +
                    "translate(" + rad_name + ")rotate(180)";
            })
            .style("font-size", (9 * size_factor) + "px");

        ///////////////////////////////////////////////////////////////////////////
        ///////////////////////////// Create name dots ////////////////////////////
        /////////////////////////////////////////////////////////////////////////// 

        var characterByName = [];
        //Color of the dot behind the name can be the type
        character_total_data.forEach(function(d, i) {
            var text_width_first = document.getElementById('name-label-' + i).getComputedTextLength();
            var text_width_last = document.getElementById('last-name-label-' + i).getComputedTextLength();
            //d.dot_name_rad = rad_name + Math.max(text_width_first, text_width_last) + 10;
            d.dot_name_rad = rad_name + 76; //puntos del nombre
            d.name_angle = (arcs[i].endAngle - arcs[i].startAngle) / 2 + arcs[i].startAngle;
            characterByName[d.character] = d;
        })

        //Create hover circle that shows when you hover over a character
        var rad_hover_circle = 35 * size_factor;
        var hover_circle = hover_circle_group.selectAll(".hover-circle")
            .data(character_total_data)
            .enter().append("circle")
            .attr("class", "hover-circle")
            .attr("cx", function(d) { return d.dot_name_rad * Math.cos(d.name_angle - pi1_2); })
            .attr("cy", function(d) { return d.dot_name_rad * Math.sin(d.name_angle - pi1_2); })
            .attr("r", rad_hover_circle)
            .style("fill", function(d) { return d.color; })
            .style("fill-opacity", 0.3)
            .style("opacity", 0);

        //Add a circle at the end of each name of each character
        var name_dot_group = chart.append("g").attr("class", "name-dot-group");
        var name_dot = name_dot_group.selectAll(".type-dot")
            .data(character_total_data)
            .enter().append("circle")
            .attr("class", "type-dot")
            .attr("cx", function(d) { return d.dot_name_rad * Math.cos(d.name_angle - pi1_2); })
            .attr("cy", function(d) { return d.dot_name_rad * Math.sin(d.name_angle - pi1_2); })
            //.attr("cx", function(d) { return 220 * Math.cos(d.name_angle - pi1_2); })
            //.attr("cy", function(d) { return 220 * Math.sin(d.name_angle - pi1_2); })
            .attr("r", 8 * size_factor)
            .style("fill", function(d) { return d.color; })
            .style("stroke", "none")
            .style("stroke-width", 3 * size_factor);

        ///////////////////////////////////////////////////////////////////////////
        ////////////////////////// Create inner relations /////////////////////////
        /////////////////////////////////////////////////////////////////////////// 

        var pull_scale = d3.scaleLinear()
            .domain([2 * rad_relation, 0])
            .range([0.7, 2.3]);
        var color_relation = d3.scaleOrdinal()
            .domain(["family", 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]) //"teacher","ex-lovers","reincarnation","rival"
            .range(["#dc5d46", "#184434", "#005850", "#00837B", "#00A19B", "#00BBB4", "#10CFC9", "#6BDAD5", "#007960", "#009579", "#00A887", "#2ED9C3", "#87E1D1", "#A5E5D9"])
            .unknown("#bbbbbb");
        var stroke_relation = d3.scaleOrdinal()
            .domain(["family", "crush", "love", "friends", "master"]) //"teacher","ex-lovers","reincarnation","rival"
            .range([3, 3, 3, 3, 3]) //tamaño de las lineas
            .unknown(3);

        var relation_group = chart.append("g").attr("class", "relation-group");

        //Create the lines in between the characters that have some sort of relation
        var relation_lines = relation_group.selectAll(".relation-path")
            .data(relation_data)
            .enter().append("path")
            .attr("class", "relation-path")
            .style("fill", "none")
            .style("stroke", function(d) { return color_relation(d.type); })
            .style("stroke-width", function(d) { return stroke_relation(d.type) * size_factor; })
            .style("stroke-linecap", "round")
            .style("mix-blend-mode", "multi-")
            .style("stroke-width", 2 * size_factor + "px") //cambio
            .style("opacity", 1) //0.7->que tanto quieres que se vean las lineas centrales
            .attr("d", create_relation_lines);

        function create_relation_lines(d) {
            var source_a = characterByName[d.source].name_angle,
                target_a = characterByName[d.target].name_angle;
            var x1 = (rad_relation * .95) * Math.cos(source_a - pi1_2),
                y1 = (rad_relation * .95) * Math.sin(source_a - pi1_2),
                x2 = (rad_relation * .95) * Math.cos(target_a - pi1_2),
                y2 = (rad_relation * .95) * Math.sin(target_a - pi1_2);
            var dx = x2 - x1,
                dy = y2 - y1,
                dr = Math.sqrt(dx * dx + dy * dy);
            var curve = dr * 1 / pull_scale(dr);

            //Get the angles to determine the optimum sweep flag
            var delta_angle = (target_a - source_a) / Math.PI;
            var sweep_flag = 0;
            if ((delta_angle > -1 && delta_angle <= 0) || (delta_angle > 1 && delta_angle <= 2))
                sweep_flag = 1;

            return "M" + x1 + "," + y1 + " A" + curve + "," + curve + " 0 0 " + sweep_flag + " " + x2 + "," + y2;
        }

        ///////////////////////////////////////////////////////////////////////////
        ///////////////////// Create inner relation hover areas ///////////////////
        /////////////////////////////////////////////////////////////////////////// 

        var relation_hover_group = chart.append("g").attr("class", "relation-hover-group");
        var relation_hover_lines = relation_hover_group.selectAll(".relation-hover-path")
            .data(relation_data)
            .enter().append("path")
            .attr("class", "relation-hover-path")
            .style("fill", "none")
            .style("stroke", "white")
            .style("stroke-width", 16 * size_factor) //es sobre el circulo imagen
            .style("opacity", 0) //es el circulo blanco del primero
            .attr("d", create_relation_lines)
            .on("mouseover", mouse_over_relation)
            .on("mouseout", mouse_out)

        //Call and create the textual part of the annotations
        var annotation_relation_group = chart.append("g").attr("class", "annotation-relation-group");

        function mouse_over_relation(d, i) { //funcion interna de las primeras relaciones
            d3.event.stopPropagation();
            mouse_over_in_action = true;

            //Ocultar lineas externas
            ctx.clearRect(-width / 2, -height / 2, width, height);
            line_label_path.attr("d", label_arc(0));

            clearTimeout(remove_text_timer);

            //Only show the hovered relationship
            relation_lines.filter(function(c, j) { return j !== i; })
                .style("opacity", 0.15); //0.05
            //marco mas la seleccionada
            relation_lines.filter(function(c, j) { return j == i; })
                .style("opacity", 0.95);
        }

        ///////////////////////////////////////////////////////////////////////////
        //////////////////////// Create cover chapter circle //////////////////////
        /////////////////////////////////////////////////////////////////////////// 

        //Add a circle at the center that will show the cover image on hover
        var cover_circle_group = chart.append("g").attr("class", "cover-circle-group");
        var cover_circle = cover_circle_group.append("circle")
            .attr("class", "cover-circle")
            .attr("cx", 0)
            .attr("cy", 0)
            .attr("r", rad_image)
            .style("fill", "none");

        ///////////////////////////////////////////////////////////////////////////
        ////////////////////// Create hidden name hover areas /////////////////////
        /////////////////////////////////////////////////////////////////////////// 

        var arc_character_hover = d3.arc()
            .outerRadius(function(d, i) { return character_total_data[i].dot_name_rad + rad_hover_circle; })
            .innerRadius(rad_donut_inner)

        //////////////////Esto son los textos del primer circulo///////////////////////////
        //Create the donut slices per character (and the number of chapters they appeared in)
        var character_hover_group = chart.append("g").attr("class", "character-hover-group");
        var character_hover = character_hover_group.selectAll(".character-hover-arc")
            .data(arcs)
            .enter().append("path")
            .attr("class", "character-hover-arc")
            .attr("d", arc_character_hover)
            .style("fill", "none")
            .style("pointer-events", "all")
            .on("click", mouse_click)
            .on("mouseover", mouse_over_character)
            .on("mouseout", mouse_out);

        function mouse_click(d, i) {
            alert("Oprimio el nombre: " + d.data.full_name)
        }

        function mouse_over_character(d, i) { //funciones de cuando estas en el nombre del primer arco  //venir aqui
            document.documentElement.style.cursor = "cell"; //puntero que cambia si es para un click aqui
            d3.event.stopPropagation();
            mouse_over_in_action = true;

            //Show the chosen lines
            ctx.clearRect(-width / 2, -height / 2, width, height);
            ctx.globalAlpha = 0.8;
            create_lines("character", character_data.filter(function(c, j) { return c.character === d.character; }));

            //Update label path
            line_label_path.attr("d", label_arc(characterByName[d.character].name_angle));
            //Textos de tipo y tienda
            clearTimeout(remove_text_timer);
            var band = 0;
            var label_words;
            var tiendas = ['Distrito', 'People', 'A la Montaña', 'Transvision', 'La Bici', 'Ciclópolis', 'Chop Chop', 'Benotto'];
            tiendas.forEach(element => {
                if (d.character == element) {
                    label_words = 'Tienda: ' + d.data.full_name;
                    band = 1;
                }
            });
            if (band == 0) {
                label_words = 'Tipo: ' + d.data.full_name;
            }
            line_label.text(" " + label_words + " ");
            //aqui modificar el texto 
            font = "◻"
            for (var i = 0; i < label_words.length - 3; i++) {
                font = font.concat('◻')
            }
            line_label_font.text(font);

            //Highlight the chapters this character appears in
            var char_chapters = character_data
                .filter(function(c) { return c.character === d.character; })
                .map(function(c) { return c.chapter; });
            var char_color = characterByName[d.character].color;
            chapter_hover_slice.filter(function(c, j) { return char_chapters.indexOf(j + 1) >= 0; })
                .style("fill", char_color) //char_color
                .style("stroke", char_color); //
            chapter_number.filter(function(c, j) { return char_chapters.indexOf(j + 1) >= 0; })
                .style("fill", "#EDECDD");
            chapter_dot.filter(function(c, j) { return char_chapters.indexOf(j + 1) >= 0; })
                .attr("r", chapter_dot_rad * 1.5)
                .style("stroke-width", chapter_dot_rad * 0.5 * 1.5)
                .style("fill", char_color); //char_color

            //Funciones para los 6 arcos con puntos de precios
            var data_res = []
            price_data.forEach(element => {
                if (element.character == d.character) {
                    data_res[element.chapter - 1] = element.price;
                }
            });

            //mostrar puntos
            var band = 0;
            chapter_dot2.filter(function(c, j) { //primer arco
                    band = 0;
                    try {
                        data_res[j].forEach(element => {
                            if (element == 1) {
                                band = 1;
                            }
                        });
                    } catch (error) {}
                    if (band == 1) {
                        return char_chapters.indexOf(j + 1) >= 0;
                    }
                })
                .attr("r", chapter_dot_rad * 4)
                .style("stroke-width", chapter_dot_rad * 0.5 * 1.5)
                .style("fill", '#564c41');

            chapter_dot3.filter(function(c, j) { //segundo arco
                    band = 0;
                    try {
                        data_res[j].forEach(element => {
                            if (element == 2) {
                                band = 1;
                            }
                        });
                    } catch (error) {}
                    if (band == 1) {
                        return char_chapters.indexOf(j + 1) >= 0;
                    }
                })
                .attr("r", chapter_dot_rad * 5)
                .style("stroke-width", chapter_dot_rad * 0.5 * 1.5)
                .style("fill", '#755f4b');

            chapter_dot4.filter(function(c, j) { //tercer arco
                    band = 0;
                    try {
                        data_res[j].forEach(element => {
                            if (element == 3) {
                                band = 1;
                            }
                        });
                    } catch (error) {}
                    if (band == 1) {
                        return char_chapters.indexOf(j + 1) >= 0;
                    }
                })
                .attr("r", chapter_dot_rad * 6)
                .style("stroke-width", chapter_dot_rad * 0.5 * 1.5)
                .style("fill", '#856141');

            chapter_dot5.filter(function(c, j) { //cuarto arco
                    band = 0;
                    try {
                        data_res[j].forEach(element => {
                            if (element == 4) {
                                band = 1;
                            }
                        });
                    } catch (error) {}
                    if (band == 1) {
                        return char_chapters.indexOf(j + 1) >= 0;
                    }
                })
                .attr("r", chapter_dot_rad * 7)
                .style("stroke-width", chapter_dot_rad * 0.5 * 1.5)
                .style("fill", '#a36738');

            chapter_dot6.filter(function(c, j) { //quinto arco
                    band = 0;
                    try {
                        data_res[j].forEach(element => {
                            if (element == 5) {
                                band = 1;
                            }
                        });
                    } catch (error) {}
                    if (band == 1) {
                        return char_chapters.indexOf(j + 1) >= 0;
                    }
                })
                .attr("r", chapter_dot_rad * 8)
                .style("stroke-width", chapter_dot_rad * 0.5 * 1.5)
                .style("fill", '#ba662b');

            chapter_dot7.filter(function(c, j) { //sexto arco
                    band = 0;
                    try {
                        data_res[j].forEach(element => {
                            if (element == 6) {
                                band = 1;
                            }
                        });
                    } catch (error) {}
                    if (band == 1) {
                        return char_chapters.indexOf(j + 1) >= 0;
                    }
                })
                .attr("r", chapter_dot_rad * 9)
                .style("stroke-width", chapter_dot_rad * 0.5 * 1.5)
                .style("fill", '#d96c21');

            //para mostrar las relaciones de adentro, cuando seleccionas algun nombre
            relation_lines.filter(function(c, j) {
                    if (relation_lines._groups[0][j].__data__.source != d.character) {
                        if (relation_lines._groups[0][j].__data__.target == d.character) {
                            return 0;
                        }
                        return relation_lines._groups[0][j].__data__.source !== d.character;
                    }
                })
                .style("opacity", 0); //0.05
            //Marco mas las correctas desde source
            relation_lines.filter(function(c, j) {
                    if (relation_lines._groups[0][j].__data__.source == d.character) {
                        return relation_lines._groups[0][j].__data__.source == d.character;
                    }
                })
                .style("opacity", 0.9)
                .style("stroke", "white"); //color tipo
            //Marco de otro color de tipo -> tienda 
            relation_lines.filter(function(c, j) {
                    if (relation_lines._groups[0][j].__data__.target == d.character) {
                        return relation_lines._groups[0][j].__data__.target == d.character;
                    }
                })
                .style("opacity", 0.9)
                .style("stroke", "#dc5d46"); //color tienda

            //arc visible
            arc1.style("stroke", "white");
            arc2.style("stroke", "white");
            arc3.style("stroke", "white");
            arc4.style("stroke", "white");
            arc5.style("stroke", "white");
            arc6.style("stroke", "white");
            //Remarco mas el que esoty seleccionando
            var char_chapters = character_data
                .filter(function(c) { return c.chapter === i + 1; })
                .map(function(c) { return c.character; });

            names.filter(function(c) {
                    if (c.character != d.data.character) {
                        return true;
                    } else {
                        return false;
                    }
                })
                .style("opacity", 0.2);

            var quien;
            for (var ww = 0; ww < 42; ww++) {
                if (relation_lines._groups[0][ww].__data__.source == d.character) {
                    quien = relation_lines._groups[0][ww].__data__.target;
                    //console.log("->", relation_lines._groups[0][ww].__data__.target)
                    names.filter(function(c) {
                            if (c.character == quien) {
                                return true;
                            } else {
                                return false;
                            }
                        })
                        .style("opacity", 1);
                }
                if (relation_lines._groups[0][ww].__data__.target == d.character) {
                    quien = relation_lines._groups[0][ww].__data__.source;
                    //console.log("->", relation_lines._groups[0][ww].__data__.source)
                    names.filter(function(c) {
                            if (c.character == quien) {
                                return true;
                            } else {
                                return false;
                            }
                        })
                        .style("opacity", 1);
                }
            }

            name_dot.filter(function(c) {
                    if (c.character != d.data.character) {
                        return true;
                    } else {
                        return false;
                    }
                })
                .style("opacity", 0.2);
        } //function mouse_over_character

        ///////////////////////////////////////////////////////////////////////////
        ///////////////////////// Create chapter donut chart //////////////////////
        /////////////////////////////////////////////////////////////////////////// 

        //Create groups in right order
        var chapter_group = chart.append("g").attr("class", "chapter-group");
        var donut_chapter_group = chapter_group.append("g").attr("class", "donut-chapter-group");
        var chapter_dot_group = chapter_group.append("g").attr("class", "chapter-dot-group");
        var donut_chapter_hover_group = chapter_group.append("g").attr("class", "donut-chapter_hover-group");
        var chapter_num_group = chapter_group.append("g").attr("class", "chapter-number-group");

        //tamaño del arco exterior
        //Arc command for the chapter number donut chart
        var arc_chapter = d3.arc()
            .outerRadius(rad_chapter_donut_outer + 7)
            .innerRadius(rad_chapter_donut_inner)
            .padAngle(0.085)
            .cornerRadius((rad_chapter_donut_outer + 20 - rad_chapter_donut_inner) / 2)

        //Create the donut slices per character (and the number of chapters they appeared in)
        var chapter_slice = donut_chapter_group.selectAll(".arc")
            .data(chapter_location_data)
            .enter().append("path")
            .attr("class", "arc")
            .attr("d", arc_chapter)
            .style("fill", "#76ab99") //el fondo
            .style("stroke", "#76ab99") //#c4c4c4 estos son los circulos sobre los numeros, segundo circulo
            .style("stroke-width", 1 * size_factor); // que tanto se marca la orilla

        //Create the donut slices per character (and the number of chapters they appeared in)
        var chapter_hover_slice = donut_chapter_hover_group.selectAll(".arc")
            .data(chapter_location_data)
            .enter().append("path")
            .attr("class", "arc")
            .attr("d", arc_chapter)
            .style("fill", "none")
            .style("stroke", "none")
            .style("stroke-width", 1.5 * size_factor); //1.5

        //The text is placed in the center of each donut slice
        var rad_chapter_donut_half = ((rad_chapter_donut_outer + 7 - rad_chapter_donut_inner) / 2 + rad_chapter_donut_inner); //re acomodo de +7 por hacerlo mas grande

        //Add chapter number text
        var chapter_number = chapter_num_group.selectAll(".chapter-number")
            .data(chapter_location_data)
            .enter().append("text")
            .attr("class", "chapter-number")
            .style("text-anchor", "middle") //middle
            .attr("dy", ".35em") //.35
            .attr("transform", function(d, i) {
                var angle = d.centerAngle * 180 / Math.PI - 90;
                return "rotate(" + angle + ")translate(" + rad_chapter_donut_half + ")" +
                    "rotate(" + -angle + ")";
            })
            //.style("font-size", (12 * size_factor) + "px") //9
            .style("font-size", (17 * size_factor) + "px")
            .style("font-family", 'RobotoCondBold')
            .style("fill", '#EDECDD')
            .text(function(d, i) { return i + 1; });

        //Add a circle at the inside of each chapter slice
        var chapter_dot_rad = 1.9 * size_factor; //3.5 tamaño del circulito del capitulo
        var chapter_dot = chapter_dot_group.selectAll(".chapter-dot")
            .data(chapter_location_data)
            .enter().append("circle")
            .attr("class", "chapter-dot")
            .attr("cx", function(d) { return rad_dot_color * Math.cos(d.centerAngle - pi1_2); })
            .attr("cy", function(d) { return rad_dot_color * Math.sin(d.centerAngle - pi1_2); })
            .attr("r", chapter_dot_rad)
            .style("fill", "#c4c4c4")
            .style("stroke", "white")
            .style("stroke-width", chapter_dot_rad * 0.5);

        ///////////////////////////////////////////////////////////////////////////
        ///////////////////// Create hidden chapter hover areas ///////////////////
        /////////////////////////////////////////////////////////////////////////// 

        var arc_chapter_hover = d3.arc()
            .outerRadius(rad_chapter_outer)
            .innerRadius(rad_chapter_inner);

        //Create the donut slices per chapter
        var chapter_hover_group = chart.append("g").attr("class", "chapter-hover-group");
        var chapter_hover = chapter_hover_group.selectAll(".chapter-hover-arc")
            .data(chapter_location_data)
            .enter().append("path")
            .attr("class", "chapter-hover-arc")
            .attr("d", arc_chapter_hover)
            .style("fill", "none")
            .style("pointer-events", "all")
            .on("mouseover", mouse_over_chapter)
            .on("mouseout", mouse_out);

        var marcas = [
                'Specialized',
                'Lynx',
                'Simplebikes',
                'Schwinn',
                'Huffy',
                'Ironhorse',
                'NorthRock',
                'Gospel',
                'State',
                'Turbo',
                'Mongoose',
                'Alumbike',
                'Benotto',
                'Bickerton',
                'Liv',
                'Wolf',
                'Java',
                'Masi Bicycles',
                'All-City Cycles',
                'Bamboocycles',
                'Bianchi',
                'Polo And Bike',
                'Bulls',
                'Chop Chop Bikes',
                'Pelago Bicycles',
                'Tern Bicycles',
                'Schindelhauer bikes',
                'Pinarello',
                'Cannondale',
                'Look',
                'Merida',
                'Giant'
            ]
            //When you mouse over a chapter arc
        function mouse_over_chapter(d, i) {
            d3.event.stopPropagation();
            mouse_over_in_action = true;

            ctx.clearRect(-width / 2, -height / 2, width, height);
            ctx.lineWidth = 2 * size_factor;
            ctx.globalAlpha = 1;
            create_lines("chapter", character_data.filter(function(c) { return c.chapter === i + 1; }));

            //Update label path
            line_label_path.attr("d", label_arc(d.centerAngle));
            //Update the label text
            clearTimeout(remove_text_timer);
            line_label.text('Marca: ' + marcas[i]); //20px
            var neww = 'Marca: ' + marcas[i];
            font = "◻"
            for (var cont = 0; cont < neww.length - 4; cont++) {
                font = font.concat('◻')
            }
            line_label_font.text(font);

            //Highlight the characters that appear in this chapter
            var char_chapters = character_data
                .filter(function(c) { return c.chapter === i + 1; })
                .map(function(c) { return c.character; });

            //nombres y punto de los nombres
            names.filter(function(c) { return char_chapters.indexOf(c.character) < 0; })
                .style("opacity", 0.2);
            name_dot.filter(function(c) { return char_chapters.indexOf(c.character) < 0; })
                .style("opacity", 0.2);

            //Highlight the chapter donut slice
            chapter_hover_slice.filter(function(c, j) { return i === j; })
                .style("fill", "#407463") //color_sakura
                .style("stroke", "#407463"); //color_sakura
            chapter_number.filter(function(c, j) { return i === j; })
                .style("fill", "#EDECDD");
            chapter_dot.filter(function(c, j) { return i === j; })
                .attr("r", chapter_dot_rad * 1)
                .style("stroke-width", chapter_dot_rad * 0.5 * 1.5)
                .style("fill", color_sakura);

            //relaciones centrales
            relation_lines.filter(function(c, j) {
                    return relation_lines._groups[0][j].__data__.source !== 'opacite';
                })
                .style("opacity", 0); //cuando elijo numero quito lo de adentro

            //Funciones para los 6 arcos con puntos de precios
            var data_res = []
            price_chapter.forEach(element => {
                if (element.chapter == d.data.num) {
                    data_res[element.chapter - 1] = element.price;
                }
            });

            //mostrar puntos
            var band = 0;
            chapter_dot2.filter(function(c, j) { //primer arco
                    band = 0;
                    try {
                        data_res[j].forEach(element => {
                            if (element == 1) {
                                band = 1;
                            }
                        });
                    } catch (error) {}
                    if (band == 1) {
                        return true;
                    }
                })
                .attr("r", chapter_dot_rad * 4)
                .style("stroke-width", chapter_dot_rad * 0.5 * 1.5)
                .style("fill", '#564c41');

            chapter_dot3.filter(function(c, j) { //segundo arco
                    band = 0;
                    try {
                        data_res[j].forEach(element => {
                            if (element == 2) {
                                band = 1;
                            }
                        });
                    } catch (error) {}
                    if (band == 1) {
                        return true;
                    }
                })
                .attr("r", chapter_dot_rad * 5)
                .style("stroke-width", chapter_dot_rad * 0.5 * 1.5)
                .style("fill", '#755f4b');

            chapter_dot4.filter(function(c, j) { //tercer arco
                    band = 0;
                    try {
                        data_res[j].forEach(element => {
                            if (element == 3) {
                                band = 1;
                            }
                        });
                    } catch (error) {}
                    if (band == 1) {
                        return true;
                    }
                })
                .attr("r", chapter_dot_rad * 6)
                .style("stroke-width", chapter_dot_rad * 0.5 * 1.5)
                .style("fill", '#856141');

            chapter_dot5.filter(function(c, j) { //cuarto arco
                    band = 0;
                    try {
                        data_res[j].forEach(element => {
                            if (element == 4) {
                                band = 1;
                            }
                        });
                    } catch (error) {}
                    if (band == 1) {
                        return true;
                    }
                })
                .attr("r", chapter_dot_rad * 7)
                .style("stroke-width", chapter_dot_rad * 0.5 * 1.5)
                .style("fill", '#a36738');

            chapter_dot6.filter(function(c, j) { //quinto arco
                    band = 0;
                    try {
                        data_res[j].forEach(element => {
                            if (element == 5) {
                                band = 1;
                            }
                        });
                    } catch (error) {}
                    if (band == 1) {
                        return true;
                    }
                })
                .attr("r", chapter_dot_rad * 8)
                .style("stroke-width", chapter_dot_rad * 0.5 * 1.5)
                .style("fill", '#ba662b');

            chapter_dot7.filter(function(c, j) { //sexto arco
                    band = 0;
                    try {
                        data_res[j].forEach(element => {
                            if (element == 6) {
                                band = 1;
                            }
                        });
                    } catch (error) {}
                    if (band == 1) {
                        return true;
                    }
                })
                .attr("r", chapter_dot_rad * 9)
                .style("stroke-width", chapter_dot_rad * 0.5 * 1.5)
                .style("fill", '#d96c21');

            //arc visible
            arc1.style("stroke", "white");
            arc2.style("stroke", "white");
            arc3.style("stroke", "white");
            arc4.style("stroke", "white");
            arc5.style("stroke", "white");
            arc6.style("stroke", "white");
        }

        ///////////////////////////////////////////////////////////////////////////
        ///////////////////////// General mouse out function //////////////////////
        /////////////////////////////////////////////////////////////////////////// 

        container.on("mouseout", mouse_out);

        //When you mouse out of a chapter or character
        function mouse_out() {
            document.documentElement.style.cursor = "default"; //mouse cuando no selecciona nada
            //Only run this if there was a mouseover before
            if (!mouse_over_in_action) return;
            mouse_over_in_action = false;

            ctx.clearRect(-width / 2, -height / 2, width, height);
            ctx.globalAlpha = cover_alpha;
            create_lines("character", cover_data);

            //Update the label text
            line_label.text("") //si quieres dejar el mensaje default  default_label_text
            line_label_font.text("");
            remove_text_timer = setTimeout(function() { line_label.text("") }, 6000);

            //Character names back to normal
            names.style("opacity", null);
            name_dot.style("opacity", null);

            //Character names back to normal
            names.style("opacity", null);
            name_dot.style("opacity", null);

            //Chapter donut back to normal
            chapter_hover_slice.style("fill", "none").style("stroke", "none");
            chapter_number.style("fill", null);
            chapter_dot
                .attr("r", chapter_dot_rad)
                .style("stroke-width", chapter_dot_rad * 0.5)
                .style("fill", "#c4c4c4");

            //Funciones para los 6 arcos, no mostrar las bolitas
            chapter_dot2
                .attr("r", chapter_dot_rad)
                .style("stroke-width", chapter_dot_rad * 0.5)
                .style("fill", "none");
            chapter_dot3
                .attr("r", chapter_dot_rad)
                .style("stroke-width", chapter_dot_rad * 0.5)
                .style("fill", "none");
            chapter_dot4
                .attr("r", chapter_dot_rad)
                .style("stroke-width", chapter_dot_rad * 0.5)
                .style("fill", "none");
            chapter_dot5
                .attr("r", chapter_dot_rad)
                .style("stroke-width", chapter_dot_rad * 0.5)
                .style("fill", "none");
            chapter_dot6
                .attr("r", chapter_dot_rad)
                .style("stroke-width", chapter_dot_rad * 0.5)
                .style("fill", "none");
            chapter_dot7
                .attr("r", chapter_dot_rad)
                .style("stroke-width", chapter_dot_rad * 0.5)
                .style("fill", "none");
            //Remove cover image
            cover_circle.style("fill", "none");
            cover_image.attr("xlink:href", "img/white-square.jpg");

            //arc invisible
            /*
            arc1.style("stroke", "none");
            arc2.style("stroke", "none");
            arc3.style("stroke", "none");
            arc4.style("stroke", "none");
            arc5.style("stroke", "none");
            arc6.style("stroke", "none");
            */

            //Hide the hover circle
            hover_circle.style("opacity", 0);

            //Bring all relationships back
            relation_lines.style("opacity", 0.7); //retorno
            //Remove relationship annotation
            annotation_relation_group.selectAll(".annotation").remove();

            //regresar al color inicial
            relation_lines.style("stroke", function(c, j) {
                return color_relation(c.type);
            });

            /*
            //ocultar el hover
            ctx.clearRect(-width / 2, -height / 2, width, height);
            line_label_path.attr("d", label_arc(0));*/
        }

        ///////////////////////////////////////////////////////////////////////////
        //////////////////////// Crear circulos externos //////////////////////////-------------------------------------------------
        /////////////////////////////////////////////////////////////////////////// 
        var donut_chapter_group2 = chapter_group.append("g").attr("class", "donut-chapter-group2");
        var donut_chapter_hover_group2 = chapter_group.append("g").attr("class", "donut-chapter_hover-group2");
        var chapter_dot_group2 = chapter_group.append("g").attr("class", "chapter-dot-group");
        var arc_chapter2 = d3.arc()
            .outerRadius(rad_chapter_donut_outer + 31)
            .innerRadius(rad_chapter_donut_inner + 30)
            .padAngle(0.11) //la separacion
            .cornerRadius((rad_chapter_donut_outer - rad_chapter_donut_inner) / 2)
        var chapter_slice2 = donut_chapter_group2.selectAll(".arc")
            .data(chapter_location_data)
            .enter().append("path")
            .attr("class", "arc")
            .attr("d", arc_chapter2)
            .style("fill", "none") //el fondo #564e45
            .style("stroke", "none") //#c4c4c4 estos son los circulos sobre los numeros, segundo circulo
            .style("stroke-width", 0.02 * size_factor);
        var chapter_hover_slice2 = donut_chapter_hover_group2.selectAll(".arc")
            .data(chapter_location_data)
            .enter().append("path")
            .attr("class", "arc")
            .attr("d", arc_chapter2)
            .style("fill", "none")
            .style("stroke", "none")
            .style("stroke-width", 1 * size_factor); //1.5
        var chapter_dot_rad2 = 1.2 * size_factor; //3.5 tamaño del circulito del capitulo
        var chapter_dot2 = chapter_dot_group2.selectAll(".chapter-dot")
            .data(chapter_location_data)
            .enter().append("circle")
            .attr("class", "chapter-dot")
            .attr("cx", function(d) { return (rad_dot_color + 32) * Math.cos(d.centerAngle - pi1_2); })
            .attr("cy", function(d) { return (rad_dot_color + 32) * Math.sin(d.centerAngle - pi1_2); })
            .attr("r", chapter_dot_rad2)
            .style("fill", "none")
            .style("stroke", "none")
            .style("stroke-width", chapter_dot_rad2 * 10);
        //segunda
        var donut_chapter_group3 = chapter_group.append("g").attr("class", "donut-chapter-group3");
        var donut_chapter_hover_group3 = chapter_group.append("g").attr("class", "donut-chapter_hover-group3");
        var chapter_dot_group3 = chapter_group.append("g").attr("class", "chapter-dot-group");
        var arc_chapter3 = d3.arc()
            .outerRadius(rad_chapter_donut_outer + 54)
            .innerRadius(rad_chapter_donut_inner + 52)
            .padAngle(0.106) //la separacion
            .cornerRadius((rad_chapter_donut_outer + 100 - rad_chapter_donut_inner) / 2)
        var chapter_slice3 = donut_chapter_group3.selectAll(".arc")
            .data(chapter_location_data)
            .enter().append("path")
            .attr("class", "arc")
            .attr("d", arc_chapter3)
            .style("fill", "none") //el fondo #564e45
            .style("stroke", "none") //#c4c4c4 estos son los circulos sobre los numeros, segundo circulo
            .style("stroke-width", 0 * size_factor);
        var chapter_hover_slice3 = donut_chapter_hover_group3.selectAll(".arc")
            .data(chapter_location_data)
            .enter().append("path")
            .attr("class", "arc")
            .attr("d", arc_chapter3)
            .style("fill", "none")
            .style("stroke", "none")
            .style("stroke-width", 1 * size_factor);
        var chapter_dot_rad3 = 1.2 * size_factor; //3.5 tamaño del circulito del capitulo
        var chapter_dot3 = chapter_dot_group3.selectAll(".chapter-dot")
            .data(chapter_location_data)
            .enter().append("circle")
            .attr("class", "chapter-dot")
            .attr("cx", function(d) { return (rad_dot_color + 55) * Math.cos(d.centerAngle - pi1_2); })
            .attr("cy", function(d) { return (rad_dot_color + 55) * Math.sin(d.centerAngle - pi1_2); })
            .attr("r", chapter_dot_rad3)
            .style("fill", "none")
            .style("stroke", "none")
            .style("stroke-width", chapter_dot_rad3 * 10);
        //tercera
        var donut_chapter_group4 = chapter_group.append("g").attr("class", "donut-chapter-group4");
        var donut_chapter_hover_group4 = chapter_group.append("g").attr("class", "donut-chapter_hover-group4");
        var chapter_dot_group4 = chapter_group.append("g").attr("class", "chapter-dot-group4");
        var arc_chapter4 = d3.arc()
            .outerRadius(rad_chapter_donut_outer + 78)
            .innerRadius(rad_chapter_donut_inner + 74)
            .padAngle(0.101) //la separacion
            .cornerRadius((rad_chapter_donut_outer + 100 - rad_chapter_donut_inner) / 2)
        var chapter_slice4 = donut_chapter_group4.selectAll(".arc")
            .data(chapter_location_data)
            .enter().append("path")
            .attr("class", "arc")
            .attr("d", arc_chapter4)
            .style("fill", "none") //el fondo #564e45
            .style("stroke", "none") //#c4c4c4 estos son los circulos sobre los numeros, segundo circulo
            .style("stroke-width", 0 * size_factor);
        var chapter_hover_slice4 = donut_chapter_hover_group4.selectAll(".arc")
            .data(chapter_location_data)
            .enter().append("path")
            .attr("class", "arc")
            .attr("d", arc_chapter4)
            .style("fill", "none")
            .style("stroke", "none")
            .style("stroke-width", 1 * size_factor);
        var chapter_dot_rad4 = 1.2 * size_factor; //3.5 tamaño del circulito del capitulo
        var chapter_dot4 = chapter_dot_group4.selectAll(".chapter-dot")
            .data(chapter_location_data)
            .enter().append("circle")
            .attr("class", "chapter-dot")
            .attr("cx", function(d) { return (rad_dot_color + 78) * Math.cos(d.centerAngle - pi1_2); })
            .attr("cy", function(d) { return (rad_dot_color + 78) * Math.sin(d.centerAngle - pi1_2); })
            .attr("r", chapter_dot_rad4)
            .style("fill", "none")
            .style("stroke", "none")
            .style("stroke-width", chapter_dot_rad4 * 10);
        //cuarta
        var donut_chapter_group5 = chapter_group.append("g").attr("class", "donut-chapter-group5");
        var donut_chapter_hover_group5 = chapter_group.append("g").attr("class", "donut-chapter_hover-group5");
        var chapter_dot_group5 = chapter_group.append("g").attr("class", "chapter-dot-group5");
        var arc_chapter5 = d3.arc()
            .outerRadius(rad_chapter_donut_outer + 78)
            .innerRadius(rad_chapter_donut_inner + 75)
            .padAngle(0.101) //la separacion
            .cornerRadius((rad_chapter_donut_outer + 100 - rad_chapter_donut_inner) / 2)
        var chapter_slice5 = donut_chapter_group5.selectAll(".arc")
            .data(chapter_location_data)
            .enter().append("path")
            .attr("class", "arc")
            .attr("d", arc_chapter5)
            .style("fill", "none") //el fondo #565e55
            .style("stroke", "none") //#c5c5c5 estos son los circulos sobre los numeros, segundo circulo
            .style("stroke-width", 0 * size_factor);
        var chapter_hover_slice5 = donut_chapter_hover_group5.selectAll(".arc")
            .data(chapter_location_data)
            .enter().append("path")
            .attr("class", "arc")
            .attr("d", arc_chapter5)
            .style("fill", "none")
            .style("stroke", "none")
            .style("stroke-width", 1 * size_factor);
        var chapter_dot_rad5 = 1.2 * size_factor; //3.5 tamaño del circulito del capitulo
        var chapter_dot5 = chapter_dot_group5.selectAll(".chapter-dot")
            .data(chapter_location_data)
            .enter().append("circle")
            .attr("class", "chapter-dot")
            .attr("cx", function(d) { return (rad_dot_color + 101) * Math.cos(d.centerAngle - pi1_2); })
            .attr("cy", function(d) { return (rad_dot_color + 101) * Math.sin(d.centerAngle - pi1_2); })
            .attr("r", chapter_dot_rad5)
            .style("fill", "none")
            .style("stroke", "none")
            .style("stroke-width", chapter_dot_rad5 * 10);
        //quinto
        var donut_chapter_group6 = chapter_group.append("g").attr("class", "donut-chapter-group6");
        var donut_chapter_hover_group6 = chapter_group.append("g").attr("class", "donut-chapter_hover-group6");
        var chapter_dot_group6 = chapter_group.append("g").attr("class", "chapter-dot-group6");
        var arc_chapter6 = d3.arc()
            .outerRadius(rad_chapter_donut_outer + 78)
            .innerRadius(rad_chapter_donut_inner + 76)
            .padAngle(0.101) //la separacion
            .cornerRadius((rad_chapter_donut_outer + 100 - rad_chapter_donut_inner) / 2)
        var chapter_slice6 = donut_chapter_group6.selectAll(".arc")
            .data(chapter_location_data)
            .enter().append("path")
            .attr("class", "arc")
            .attr("d", arc_chapter6)
            .style("fill", "none") //el fondo #666e66
            .style("stroke", "none") //#c6c6c6 estos son los circulos sobre los numeros, segundo circulo
            .style("stroke-width", 0 * size_factor);
        var chapter_hover_slice6 = donut_chapter_hover_group6.selectAll(".arc")
            .data(chapter_location_data)
            .enter().append("path")
            .attr("class", "arc")
            .attr("d", arc_chapter6)
            .style("fill", "none")
            .style("stroke", "none")
            .style("stroke-width", 1 * size_factor);
        var chapter_dot_rad6 = 1.2 * size_factor; //3.6 tamaño del circulito del capitulo
        var chapter_dot6 = chapter_dot_group6.selectAll(".chapter-dot")
            .data(chapter_location_data)
            .enter().append("circle")
            .attr("class", "chapter-dot")
            .attr("cx", function(d) { return (rad_dot_color + 124) * Math.cos(d.centerAngle - pi1_2); })
            .attr("cy", function(d) { return (rad_dot_color + 124) * Math.sin(d.centerAngle - pi1_2); })
            .attr("r", chapter_dot_rad6)
            .style("fill", "none")
            .style("stroke", "none")
            .style("stroke-width", chapter_dot_rad6 * 10);
        //sexto
        var donut_chapter_group7 = chapter_group.append("g").attr("class", "donut-chapter-group7");
        var donut_chapter_hover_group7 = chapter_group.append("g").attr("class", "donut-chapter_hover-group7");
        var chapter_dot_group7 = chapter_group.append("g").attr("class", "chapter-dot-group7");
        var arc_chapter7 = d3.arc()
            .outerRadius(rad_chapter_donut_outer + 78)
            .innerRadius(rad_chapter_donut_inner + 77)
            .padAngle(0.101) //la separacion
            .cornerRadius((rad_chapter_donut_outer + 100 - rad_chapter_donut_inner) / 2)
        var chapter_slice7 = donut_chapter_group7.selectAll(".arc")
            .data(chapter_location_data)
            .enter().append("path")
            .attr("class", "arc")
            .attr("d", arc_chapter7)
            .style("fill", "none") //el fondo #777e77
            .style("stroke", "none") //#c7c7c7 estos son los circulos sobre los numeros, segundo circulo
            .style("stroke-width", 0 * size_factor);
        var chapter_hover_slice7 = donut_chapter_hover_group7.selectAll(".arc")
            .data(chapter_location_data)
            .enter().append("path")
            .attr("class", "arc")
            .attr("d", arc_chapter7)
            .style("fill", "none")
            .style("stroke", "none")
            .style("stroke-width", 1 * size_factor);
        var chapter_dot_rad7 = 1.2 * size_factor; //3.7 tamaño del circulito del capitulo
        var chapter_dot7 = chapter_dot_group7.selectAll(".chapter-dot")
            .data(chapter_location_data)
            .enter().append("circle")
            .attr("class", "chapter-dot")
            .attr("cx", function(d) { return (rad_dot_color + 147) * Math.cos(d.centerAngle - pi1_2); })
            .attr("cy", function(d) { return (rad_dot_color + 147) * Math.sin(d.centerAngle - pi1_2); })
            .attr("r", chapter_dot_rad7)
            .style("fill", "none")
            .style("stroke", "none")
            .style("stroke-width", chapter_dot_rad7 * 10);

        //arcos circulos
        var arc1 = donut_chapter_hover_group2.append("circle") //Drawing circle
            .attr("cx", 0) //centre x
            .attr("cy", 0) //centre y
            .attr("r", rad_chapter_donut_outer + 17) //radio
            .attr("fill", "none")
            .attr("stroke", "white")
        var arc2 = donut_chapter_hover_group3.append("circle") //Drawing circle
            .attr("cx", 0) //centre x
            .attr("cy", 0) //centre y
            .attr("r", rad_chapter_donut_outer + 40) //radio
            .attr("fill", "none")
            .attr("stroke", "white")
        var arc3 = donut_chapter_hover_group4.append("circle") //Drawing circle
            .attr("cx", 0) //centre x
            .attr("cy", 0) //centre y
            .attr("r", rad_chapter_donut_outer + 63) //radio
            .attr("fill", "none")
            .attr("stroke", "white")
        var arc4 = donut_chapter_hover_group5.append("circle") //Drawing circle
            .attr("cx", 0) //centre x
            .attr("cy", 0) //centre y
            .attr("r", rad_chapter_donut_outer + 86) //radio
            .attr("fill", "none")
            .attr("stroke", "white")
        var arc5 = donut_chapter_hover_group6.append("circle") //Drawing circle
            .attr("cx", 0) //centre x
            .attr("cy", 0) //centre y
            .attr("r", rad_chapter_donut_outer + 109) //radio
            .attr("fill", "none")
            .attr("stroke", "white")
        var arc6 = donut_chapter_hover_group7.append("circle") //Drawing circle
            .attr("cx", 0) //centre x
            .attr("cy", 0) //centre y
            .attr("r", rad_chapter_donut_outer + 132) //radio
            .attr("fill", "none")
            .attr("stroke", "white")

        //cruces del centro cruz
        var donut_chapter_group8 = chapter_group.append("g").attr("class", "donut-chapter-group8");
        var donut_chapter_hover_group8 = chapter_group.append("g").attr("class", "donut-chapter_hover-group8");
        var chapter_dot_group8 = chapter_group.append("g").attr("class", "chapter-dot-group8");
        var chapter_dot_group9 = chapter_group.append("g").attr("class", "chapter-dot-group8");
        var arc_chapter8 = d3.arc()
            .outerRadius(rad_chapter_donut_outer - 214)
            .innerRadius(rad_chapter_donut_inner - 214)
            .padAngle(0.05) //la separacion
            .cornerRadius((rad_chapter_donut_outer + 100 - rad_chapter_donut_inner) / 2)
        var chapter_slice8 = donut_chapter_group8.selectAll(".arc")
            .data(arcs)
            .enter().append("path")
            .attr("class", "arc")
            .attr("d", arc_chapter8)
            .style("fill", "none") //el fondo #888e88
            .style("stroke", "none") //#c8c8c8 estos son los circulos sobre los numeros, segundo circulo
            .style("stroke-width", 0 * size_factor);
        var chapter_hover_slice8 = donut_chapter_hover_group8.selectAll(".arc")
            .data(arcs)
            .enter().append("path")
            .attr("class", "arc")
            .attr("d", arc_chapter8)
            .style("fill", "none")
            .style("stroke", "none")
            .style("stroke-width", 1 * size_factor);
        var xx = 215
        var yy = 215
        var chapter_dot8 = chapter_dot_group8.selectAll(".chapter-dot")
            .data(arcs)
            .enter().append("line")
            .attr("class", "chapter-dot")
            .attr("x1", function(d) { return (rad_dot_color - xx) * Math.cos(d.centerAngle - pi1_2) - 4; })
            .attr("y1", function(d) { return (rad_dot_color - xx) * Math.sin(d.centerAngle - pi1_2); })
            .attr("x2", function(d) { return (rad_dot_color - xx) * Math.cos(d.centerAngle - pi1_2) + 4; })
            .attr("y2", function(d) { return (rad_dot_color - xx) * Math.sin(d.centerAngle - pi1_2); })
            .attr("stroke", "white")
            .attr("stroke-width", "2px")
            .on("click", mouse_click)
            .on("mouseover", mouse_over_character);
        var chapter_dot9 = chapter_dot_group9.selectAll(".chapter-dot")
            .data(arcs)
            .enter().append("line")
            .attr("class", "chapter-dot")
            .attr("x1", function(d) { return (rad_dot_color - yy) * Math.cos(d.centerAngle - pi1_2); })
            .attr("y1", function(d) { return (rad_dot_color - yy) * Math.sin(d.centerAngle - pi1_2) - 4; })
            .attr("x2", function(d) { return (rad_dot_color - yy) * Math.cos(d.centerAngle - pi1_2); })
            .attr("y2", function(d) { return (rad_dot_color - yy) * Math.sin(d.centerAngle - pi1_2) + 4; })
            .attr("stroke", "white")
            .attr("stroke-width", "2px")
            .on("click", mouse_click)
            .on("mouseover", mouse_over_character);
        ///////////////////////////////////////////////////////////////////////////
        ///////////////////////// Create line title label /////////////////////////-------------------------------------------------
        /////////////////////////////////////////////////////////////////////////// 

        var line_label_group = chart.append("g").attr("class", "line-label-group");

        //Define the arc on which to draw the label text
        function label_arc(angle) {
            var x1 = rad_line_label * Math.cos(angle + 0.01 - pi1_2),
                y1 = rad_line_label * Math.sin(angle + 0.01 - pi1_2);
            var x2 = rad_line_label * Math.cos(angle - 0.01 - pi1_2),
                y2 = rad_line_label * Math.sin(angle - 0.01 - pi1_2);
            if (angle / Math.PI > 0.5 && angle / Math.PI < 1.5) {
                return "M" + x1 + "," + y1 + " A" + rad_line_label + "," + rad_line_label + " 0 1 1 " + x2 + "," + y2;
            } else {
                return "M" + x2 + "," + y2 + " A" + rad_line_label + "," + rad_line_label + " 0 1 0 " + x1 + "," + y1;
            }
        }

        //Create the paths along which the pillar labels will run
        var line_label_path = line_label_group.append("path")
            .attr("class", "line-label-path")
            .attr("id", "line-label-path")
            .attr("d", label_arc(characterByName["Benotto"].name_angle))
            .style("fill", "black")
            .style("display", "none");

        //Create the label text
        var default_label_text = "Estas líneas muestran qué marcas estan relacionadas"; //el texto default de las lineas externas
        //console.log("tiene n: ", default_label_text.length)
        var font = "◻"
        for (var i = 0; i < default_label_text.length - 5; i++) {
            font = font.concat('◻')
        }
        var line_label_font = line_label_group.append("text")
            .attr("class", "line-label")
            .attr("dy", "0.33em")
            .style("stroke", "#00BBB4")
            .style("stroke-width", 10)
            .style("text-anchor", "middle")
            .style("font-size", (19 * size_factor) + "px")
            .style("font-family", 'RobotoCondBold')
            .append("textPath")
            .attr("xlink:href", "#line-label-path")
            .attr("startOffset", "50%") //50
            .text("")
            .style("fill", "#00BBB4")
            .style("opacity", 0.5);
        var line_label = line_label_group.append("text")
            .attr("class", "line-label")
            .attr("dy", "0.37em")
            //.style("stroke", "black")
            //.style("stroke-width", 0.8)
            .style("text-anchor", "middle")
            .style("font-size", (23 * size_factor) + "px")
            .style("font-family", 'RobotoCondBold')
            .append("textPath")
            .attr("xlink:href", "#line-label-path")
            .attr("startOffset", "50%") //50
            .text("")
            .style("fill", "white"); //color incial background-color: #000;


        ///////////////////////////////////////////////////////////////////////////
        //////////////////// Create character & chapter lines /////////////////////
        /////////////////////////////////////////////////////////////////////////// 

        //Line function to draw the lines from character to chapter on canvas
        var line = d3.lineRadial()
            .angle(function(d) { return d.angle; })
            .radius(function(d) { return d.radius; })
            .curve(d3.curveBasis)
            .context(ctx);

        //Draw the lines for the cover
        ctx.globalAlpha = cover_alpha;
        create_lines("character", cover_data);

        function create_lines(type, data) {
            for (var i = 0; i < data.length; i++) {
                d = data[i];
                var line_data = [];

                var source_a = characterByName[d.character].name_angle,
                    source_r = characterByName[d.character].dot_name_rad
                var target_a = chapter_location_data[d.chapter - 1].centerAngle,
                    target_r = rad_dot_color;

                //Figure out some variable that will determine the path points to create
                if (target_a - source_a < -Math.PI) {
                    var side = "cw";
                    var da = 2 + (target_a - source_a) / Math.PI;
                    var angle_sign = 1;
                } else if (target_a - source_a < 0) {
                    var side = "ccw";
                    var da = (source_a - target_a) / Math.PI;
                    var angle_sign = -1;
                } else if (target_a - source_a < Math.PI) {
                    var side = "cw";
                    var da = (target_a - source_a) / Math.PI;
                    var angle_sign = 1;
                } else {
                    var side = "ccw";
                    var da = 2 - (target_a - source_a) / Math.PI;
                    var angle_sign = -1;
                }

                //Calculate the radius of the middle arcing section of the line
                var range = type === "character" ? [rad_line_max, rad_line_min] : [rad_line_min, rad_line_max];
                var scale_rad_curve = d3.scaleLinear()
                    .domain([0, 1])
                    .range(range);
                var rad_curve_line = scale_rad_curve(da) * width;

                //Slightly offset the first point on the curve from the source
                var range = type === "character" ? [0, 0.07] : [0, 0.01];
                var scale_angle_start_offset = d3.scaleLinear()
                    .domain([0, 1])
                    .range(range);
                var start_angle = source_a + angle_sign * scale_angle_start_offset(da) * Math.PI;

                //Slightly offset the last point on the curve from the target
                var range = type === "character" ? [0, 0.02] : [0, 0.07];
                var scale_angle_end_offset = d3.scaleLinear()
                    .domain([0, 1])
                    .range(range);
                var end_angle = target_a - angle_sign * scale_angle_end_offset(da) * Math.PI;

                if (target_a - source_a < -Math.PI) {
                    var da_inner = pi2 + (end_angle - start_angle);
                } else if (target_a - source_a < 0) {
                    var da_inner = (start_angle - end_angle);
                } else if (target_a - source_a < Math.PI) {
                    var da_inner = (end_angle - start_angle);
                } else if (target_a - source_a < 2 * Math.PI) {
                    var da_inner = pi2 - (end_angle - start_angle)
                }

                //Attach first point to data
                line_data.push({
                    angle: source_a,
                    radius: source_r
                });

                //Attach first point of the curve section
                line_data.push({
                    angle: start_angle,
                    radius: rad_curve_line
                });

                //son puntos de seguimiento para que las lineas sean correctas (externas)
                //Create points in between for the curve line
                var step = 0.06;
                var n = Math.abs(Math.floor(da_inner / step));
                var curve_angle = start_angle;
                var sign = side === "cw" ? 1 : -1;
                if (n >= 1) {
                    for (var j = 0; j < n; j++) {
                        curve_angle += (sign * step) % pi2;
                        line_data.push({
                            angle: curve_angle,
                            radius: rad_curve_line
                        });
                    }
                }

                //Attach last point of the curve section
                line_data.push({
                    angle: end_angle,
                    radius: rad_curve_line
                });

                //Attach last point to data
                line_data.push({
                    angle: target_a,
                    radius: target_r
                });

                //Draw the path
                ctx.beginPath();
                line(line_data);

                //color lineas externas
                if (characterByName[d.character].color == "#de5a44") {
                    ctx.strokeStyle = characterByName[d.character].color;
                } else {
                    ctx.strokeStyle = "white"
                }

                //ctx.strokeStyle = characterByName[d.character].color;
                ctx.stroke();

            } //for

            ctx.globalAlpha = 0.7;
            ctx.lineWidth = 2 * size_factor; //cambio

        } //function create_lines

    } //function draw

    // Retina non-blurry canvas
    function crispyCanvas(canvas, ctx, sf) {
        canvas
            .attr('width', sf * width)
            .attr('height', sf * height)
            .style('width', width + "px")
            .style('height', height + "px");
        ctx.scale(sf, sf);
    }
}