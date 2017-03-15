<?php
/**
 * Author: Ole Fredrik Lie
 * URL: http://olefredrik.com
 *
 * FoundationPress functions and definitions
 *
 * Set up the theme and provides some helper functions, which are used in the
 * theme as custom template tags. Others are attached to action and filter
 * hooks in WordPress to change core functionality.
 *
 * @link https://codex.wordpress.org/Theme_Development
 * @package FoundationPress
 * @since FoundationPress 1.0.0
 */

/** Various clean up functions */
require_once( 'library/cleanup.php' );

/** Required for Foundation to work properly */
require_once( 'library/foundation.php' );

/** Format comments */
require_once( 'library/class-foundationpress-comments.php' );

/** Register all navigation menus */
require_once( 'library/navigation.php' );

/** Add menu walkers for top-bar and off-canvas */
require_once( 'library/class-foundationpress-top-bar-walker.php' );
require_once( 'library/class-foundationpress-mobile-walker.php' );

/** Create widget areas in sidebar and footer */
require_once( 'library/widget-areas.php' );

/** Return entry meta information for posts */
require_once( 'library/entry-meta.php' );

/** Enqueue scripts */
require_once( 'library/enqueue-scripts.php' );

/** Add theme support */
require_once( 'library/theme-support.php' );

/** Add Nav Options to Customer */
require_once( 'library/custom-nav.php' );

/** Change WP's sticky post class */
require_once( 'library/sticky-posts.php' );

/** Configure responsive image sizes */
require_once( 'library/responsive-images.php' );

/** If your site requires protocol relative url's for theme assets, uncomment the line below */
//<<<<<<< HEAD
// require_once( 'library/protocol-relative-theme-assets.php' );


function custom_post() {
/*Post type: Eventi*/
  register_post_type( 'eventi', /* nome del custom post type */
  // aggiungiamo ora tutte le impostazioni necessarie, in primis definiamo le varie etichette mostrate nei menù
    array('labels' => array(
        'name' => 'Eventi', /* Nome, al plurale, dell'etichetta del post type. */
        'singular_name' => 'Eventi', /* Nome, al singolare, dell'etichetta del post type. */
        'all_items' => 'Tutti gli eventi', /* Testo mostrato nei menu che indica tutti i contenuti del post type */
        'add_new' => 'Aggiungi nuovo', /* Il testo per il pulsante Aggiungi. */
        'add_new_item' => 'Aggiungi nuovo evento', /* Testo per il pulsante Aggiungi nuovo post type */
        'edit_item' => 'Modifica Evento', /*  Testo per modifica */
        'new_item' => 'Nuovo Evento' /* Testo per nuovo oggetto */
      ), /* Fine dell'array delle etichette */
        'description' => 'Elenco Eventi', /* Una breve descrizione del post type */
        'menu_icon' => get_stylesheet_directory_uri() . '/assets/images/icone-bke/eventi.png', /* Scegli l'icona da usare nel menù per il posty type */
        'public' => true, /* Definisce se il post type sia visibile sia da front-end che da back-end */
        /* la riga successiva definisce quali elementi verranno visualizzati nella schermata di creazione del post */
        'supports' => array( 'title','excerpt', 'thumbnail' ,'editor', 'custom-fields','sticky'),
        'taxonomies'=> array( 'category' )

    ) /* fine delle opzioni */
  ); /* fine della registrazione */

  /*Post type: Dipendenti*/
    register_post_type( 'dipendenti', /* nome del custom post type */
    // aggiungiamo ora tutte le impostazioni necessarie, in primis definiamo le varie etichette mostrate nei menù
      array('labels' => array(
          'name' => 'Dipendenti', /* Nome, al plurale, dell'etichetta del post type. */
          'singular_name' => 'Dipendenti', /* Nome, al singolare, dell'etichetta del post type. */
          'all_items' => 'Tutti gli Dipendenti', /* Testo mostrato nei menu che indica tutti i contenuti del post type */
          'add_new' => 'Aggiungi nuovo', /* Il testo per il pulsante Aggiungi. */
          'add_new_item' => 'Aggiungi nuovo dipendente', /* Testo per il pulsante Aggiungi nuovo post type */
          'edit_item' => 'Modifica Dipendente', /*  Testo per modifica */
          'new_item' => 'Nuovo Dipendente' /* Testo per nuovo oggetto */
        ), /* Fine dell'array delle etichette */
          'description' => 'Elenco Dipendenti', /* Una breve descrizione del post type */
          'menu_icon' => get_stylesheet_directory_uri() . '/assets/images/icone-bke/lavoro.png', /* Scegli l'icona da usare nel menù per il posty type */
          'public' => true, /* Definisce se il post type sia visibile sia da front-end che da back-end */
          /* la riga successiva definisce quali elementi verranno visualizzati nella schermata di creazione del post */
          'supports' => array( 'title','excerpt','thumbnail','custom-fields','sticky'),
            'taxonomies'=> array( 'category' )
      ) /* fine delle opzioni */
    ); /* fine della registrazione */

}

/*Post type: sliders*/
  register_post_type( 'sliders', /* nome del custom post type */
  // aggiungiamo ora tutte le impostazioni necessarie, in primis definiamo le varie etichette mostrate nei menù
    array('labels' => array(
        'name' => 'Sliders', /* Nome, al plurale, dell'etichetta del post type. */
        'singular_name' => 'Sliders', /* Nome, al singolare, dell'etichetta del post type. */
        'all_items' => 'Tutti gli Sliders', /* Testo mostrato nei menu che indica tutti i contenuti del post type */
        'add_new' => 'Aggiungi nuovo', /* Il testo per il pulsante Aggiungi. */
        'add_new_item' => 'Aggiungi nuova slide', /* Testo per il pulsante Aggiungi nuovo post type */
        'edit_item' => 'Modifica Slide', /*  Testo per modifica */
        'new_item' => 'Nuovo Slide' /* Testo per nuovo oggetto */
      ), /* Fine dell'array delle etichette */
        'description' => 'Elenco slide', /* Una breve descrizione del post type */
        'menu_icon' => get_stylesheet_directory_uri() . '/assets/images/icone-bke/slide.png', /* Scegli l'icona da usare nel menù per il posty type */
        'public' => true, /* Definisce se il post type sia visibile sia da front-end che da back-end */
        /* la riga successiva definisce quali elementi verranno visualizzati nella schermata di creazione del post */
        'supports' => array( 'title','excerpt','custom-fields','sticky')
    ) /* fine delle opzioni */
  ); /* fine della registrazione */

// Inizializzazione della funzione
add_action( 'init', 'custom_post');
//=======
// require_once( 'library/class-foundationpress-protocol-relative-theme-assets.php' );
//>>>>>>> c067a86f5e526ab35eb48a25577ddc07f372e181
